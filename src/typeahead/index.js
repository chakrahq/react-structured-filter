/* eslint eqeqeq: [2, "allow-null"] */

import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import moment from 'moment';
import fuzzy from 'fuzzy';
import DatePicker from 'antd/es/date-picker';
// import 'antd/es/date-picker/style/css';
import onClickOutside from 'react-onclickoutside';

import TypeaheadSelector from './selector';
import KeyEvent from '../keyevent';


/**
 * A "typeahead", an auto-completing text input
 *
 * Renders an text input that shows options nearby that you can use the
 * keyboard or mouse to select.  Requires CSS for MASSIVE DAMAGE.
 */
class Typeahead extends Component {
  static propTypes = {
    customClasses: PropTypes.object,
    maxVisible: PropTypes.number,
    options: PropTypes.array,
    header: PropTypes.string,
    datatype: PropTypes.string,
    defaultValue: PropTypes.string,
    placeholder: PropTypes.string,
    onOptionSelected: PropTypes.func,
    onKeyDown: PropTypes.func,
    className: PropTypes.string,
  }

  static defaultProps = {
    options: [],
    header: '',
    datatype: 'text',
    customClasses: {},
    defaultValue: '',
    placeholder: '',
    onKeyDown() { return; },
    onOptionSelected() { },
  }

  constructor( ...args ) {
    super( ...args );
    this._onTextEntryUpdated = this._onTextEntryUpdated.bind( this );
    this._onKeyDown = this._onKeyDown.bind( this );
    this._onDatePickerKeyDown = this._onDatePickerKeyDown.bind( this );
    this._onFocus = this._onFocus.bind( this );
    this._onOptionSelected = this._onOptionSelected.bind( this );
    this._handleDateChange = this._handleDateChange.bind( this );
    this._getDatePickerInputRef = this._getDatePickerInputRef.bind( this );
    this._renderDatePicker = this._renderDatePicker.bind( this );
    this._onEnter = this._onEnter.bind( this );
    this._onEscape = this._onEscape.bind( this );
    this._onTab = this._onTab.bind( this );
    // this._addTokenForValue = this._addTokenForValue.bind( this );

    this.sel = React.createRef();
    this.datepicker = React.createRef();
    this.input = React.createRef();
    this.entry = React.createRef();
  }

  state = {
    // The set of all options... Does this need to be state?  I guess for lazy load...
    options: this.props.options,
    header: this.props.header,
    datatype: this.props.datatype,

    focused: false,

    // The currently visible set of options
    visible: this.getOptionsForValue( this.props.defaultValue, this.props.options ),

    // This should be called something else, "entryValue"
    entryValue: this.props.defaultValue,

    // A valid typeahead value
    selection: null,
  }

  componentWillReceiveProps( nextProps ) {
    this.setState({
      options: nextProps.options,
      header: nextProps.header,
      datatype: nextProps.datatype,
      visible: nextProps.options,
    });
  }

  getOptionsForValue( value, options ) {
    let result = fuzzy
      .filter( value, options )
      .map( res => res.string );

    if ( this.props.maxVisible ) {
      result = result.slice( 0, this.props.maxVisible );
    }
    return result;
  }

  setEntryText( value ) {
    if ( this.entry.current != null ) {
      this.entry.current.value = value;
    }
    this._onTextEntryUpdated();
  }

  _renderIncrementalSearchResults() {
    if ( !this.state.focused ) {
      return '';
    }

    // Something was just selected
    if ( this.state.selection ) {
      return '';
    }

    // There are no typeahead / autocomplete suggestions
    if ( !this.state.visible.length ) {
      return '';
    }

    return (
      <TypeaheadSelector
        ref={ this.sel }
        options={ this.state.visible }
        header={ this.state.header }
        onOptionSelected={ this._onOptionSelected }
        customClasses={ this.props.customClasses }
      />
    );
  }

  _onOptionSelected( option ) {
    const nEntry = this.entry.current;
    nEntry.focus();
    nEntry.value = option;
    this.setState({
      visible: this.getOptionsForValue( option, this.state.options ),
      selection: option,
      entryValue: option,
    });

    this.props.onOptionSelected( option );
  }

  _onTextEntryUpdated() {
    let value = '';
    const entry = this.entry.current;
    if ( entry != null ) {
      value = entry.value;
    }
    this.setState({
      visible: this.getOptionsForValue( value, this.state.options ),
      selection: null,
      entryValue: value,
    });
  }

  _onEnter( event ) {
    const sel = this.sel.current;
    if ( !sel || !sel.state || !sel.state.selection ) {
      return this.props.onKeyDown( event );
    }

    this._onOptionSelected( sel.state.selection );
  }

  _onEscape() {
    const sel = this.sel.current;
    sel.setSelectionIndex( null );
  }

  _onTab() {
    const sel = this.sel.current;
    const option = ( !!sel && !!sel.state && !!sel.state.selection ) ?
      sel.state.selection : this.state.visible[ 0 ];
    this ._onOptionSelected( option );
  }

  eventMap() {
    const events = {};

    const sel = this.sel.current;

    if ( !!sel ) {
      events[ KeyEvent.DOM_VK_UP ] = sel.navUp;
      events[ KeyEvent.DOM_VK_DOWN ] = sel.navDown;
    }
    events[ KeyEvent.DOM_VK_RETURN ] = events[ KeyEvent.DOM_VK_ENTER ] = this._onEnter;
    events[ KeyEvent.DOM_VK_ESCAPE ] = this._onEscape;
    events[ KeyEvent.DOM_VK_TAB ] = this._onTab;

    return events;
  }

  _onKeyDown( event ) {
    // If Enter pressed
    if ( event.keyCode === KeyEvent.DOM_VK_RETURN || event.keyCode === KeyEvent.DOM_VK_ENTER ) {
      // If no options were provided so we can match on anything
      if ( this.props.options.length === 0 ) {
        this._onOptionSelected( this.state.entryValue );
      }

      // If what has been typed in is an exact match of one of the options
      if ( this.props.options.indexOf( this.state.entryValue ) > -1 ) {
        this._onOptionSelected( this.state.entryValue );
      }
    }

    // If there are no visible elements, don't perform selector navigation.
    // Just pass this up to the upstream onKeydown handler
    if ( !this.sel ) {
      return this.props.onKeyDown( event );
    }

    const handler = this.eventMap()[ event.keyCode ];

    if ( handler ) {
      handler( event );
    } else {
      return this.props.onKeyDown( event );
    }
    // Don't propagate the keystroke back to the DOM/browser
    event.preventDefault();
  }

  _onFocus() {
    this.setState({ focused: true });
  }

  handleClickOutside() {
    this.setState({ focused: false });
  }

  isDescendant( parent, child ) {
    let node = child.parentNode;
    while ( node !== null ) {
      if ( node === parent ) {
        return true;
      }
      node = node.parentNode;
    }
    return false;
  }

  _handleDateChange( date ) {
    let newDate = moment( date, 'lll' );
    if ( !newDate.isValid()) newDate = moment();
    this.props.onOptionSelected( newDate.format( 'lll' ));
  }

  _showDatePicker() {
    if ( this.state.datatype === 'date' ) {
      return true;
    }
    return false;
  }

  _getDatePickerInputRef() {
    if ( this._showDatePicker()) {
      // Reference: https://davidwalsh.name/get-react-component-element
      const datepickerNode = ReactDOM.findDOMNode( this );
      const datepickerInputElement = datepickerNode.querySelector( 'div.ant-picker-input input' );
      return datepickerInputElement;
    }
  }

  inputRef() {
    if ( this._showDatePicker()) {
      return this._getDatePickerInputRef();
    }

    return this.entry.current;
  }

  _onDatePickerKeyDown( event ) {
    // Don't propagate the keystroke back to the DOM/browser
    // event.preventDefault();

    return this.props.onKeyDown( event );
  }

  _renderDatePicker() {
    const classes = {
      typeahead: true,
    };
    classes[ this.props.className ] = !!this.props.className;
    const classList = classNames( classes );

    const datepickerInputRef = this._getDatePickerInputRef();
    if ( !!datepickerInputRef ) {
      datepickerInputRef.onkeydown = this._onDatePickerKeyDown;
    }

    let defaultDate = moment( this.state.entryValue, 'lll' );
    if ( !defaultDate.isValid()) defaultDate = null;

    return (
      <span
        ref={ this.input }
        className={ classList }
        onFocus={ this._onFocus }
      >
        <DatePicker
          ref={ this.datepicker }
          bordered={ false }
          autoFocus
          size={ "small" }
          suffixIcon={ null }
          placeholder={ this.props.placeholder }
          style={ { border: 0 } }
          showTime={ {
            defaultValue: moment( '00:00:00', 'HH:mm:ss' ),
          } }
          defaultValue={ defaultDate }
          onChange={ this._handleDateChange }
          open
        />
      </span>
    );
  }

  render() {
    if ( this._showDatePicker()) {
      return this._renderDatePicker();
    }

    const inputClasses = {};
    inputClasses[ this.props.customClasses.input ] = !!this.props.customClasses.input;
    const inputClassList = classNames( inputClasses );

    const classes = {
      typeahead: true,
    };
    classes[ this.props.className ] = !!this.props.className;
    const classList = classNames( classes );

    return (
      <span
        ref={ this.input }
        className={ classList }
        onFocus={ this._onFocus }
      >
        <input
          ref={ this.entry }
          type="text"
          placeholder={ this.props.placeholder }
          className={ inputClassList }
          defaultValue={ this.state.entryValue }
          onChange={ this._onTextEntryUpdated }
          onKeyDown={ this._onKeyDown }
        />
        { this._renderIncrementalSearchResults() }
      </span>
    );
  }
}

export default onClickOutside( Typeahead );
