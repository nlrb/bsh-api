'use strict'

const bsh = require('./bsh-const.js')
const EventEmitter = require('events')
const EventSource = require('eventsource')

/*
 * BSH Appliance class
 */
class appliance extends EventEmitter {
  /** Create a new API instance
   * @constructor
   * @param {object} api - Reference to the BSH API class
   * @param {string} haId - The Home Appliance ID
   * @param {object} state - The current state of the appliance
   */
  constructor(api, haId, details) {
    super()
    this.api = api
    this.haId = haId
    this.details = details || {}
    this.status = {}
  }

  /* Example appliance details
    { vib: 'HCS06COM1',
      brand: 'BOSCH',
      type: 'CoffeeMaker',
      name: 'CoffeeMaker Simulator',
      enumber: 'HCS06COM1/01',
      connected: true }
  */

  /**
   * Return details of the appliance
   * @param {boolean} force - false: read from cache; true: read from server
   * @returns {Promise} - An appliance object containing name, type etc.
   */
  async getDetails(force) {
    let result = Promise.resolve(this.details)
    if (force) {
      try {
        result = await this.api._executeCall(bsh.api.homeappliances.get, { haid: this.haId })
          .then(result => {
            let data = JSON.parse(result)
            if (data.data !== undefined) {
              delete data.data.haId
              return data.data
            } else {
              Promise.reject('invalid format')
            }
          })
      } catch (err) {
        result = Promise.reject(err)
      }
    }
    return result
  }

  getBrand() { return this.details.brand }
  getConnected() { return this.details.connected }
  getEnumber() { return this.details.enumber }
  getName() { return this.details.name }
  getType() { return this.details.type }
  getVib() { return this.details.vib }

  // type can be 'programs', 'status', 'options'
  static _parseResult(result) {
    let parsed
    result = JSON.parse(result)
    if (result.data !== undefined) {
      let keys = Object.keys(result.data)
      if (keys.length == 1) {
        parsed = result.data[keys[0]] // remove e.g. 'options', 'programs' etc.
      } else {
        parsed = result.data
      }
    }
    return parsed
  }

  async _apiCall(call, params, body) {
    call = eval('bsh.api.' + call)
    params = Object.assign({ haid: this.haId }, params)
    if (body !== undefined) {
      body = '{"data": ' + JSON.stringify(body) + '}'
    }
    try {
      let result = await this.api._executeCall(call, params, body)
      return appliance._parseResult(result)
    } catch(err) {
      return Promise.reject(err)
    }
  }
  _imageCall(call, params, body) { return this._apiCall('images.' + call, params, body) }
  _programCall(call, params, body) { return this._apiCall('programs.' + call, params, body) }
  _settingCall(call, params, body) { return this._apiCall('settings.' + call, params, body) }

  /**********
   * IMAGES *
   **********/

  getImages() { return this._imageCall('getList') }
  getImage(key) { return this._imageCall('get', { imagekey: key }) }

  /***********
   * PROGRAM *
   ***********/

  getActiveProgram() { return this._programCall('active.get') }
  startActiveProgram(program) { return this._programCall('active.start', undefined, program) }
  stopActiveProgram() { return this._programCall('active.stop') }

  getActiveProgramOptions() { return this._programCall('active.options.get') }
  setActiveProgramOptions(options) { return this._programCall('active.options.set', undefined, options) }

  getActiveProgramOption(key) { return this._programCall('active.option.get', { optionkey: key }) }
  setActiveProgramOption(key, value) {
    return this._programCall('active.option.set', { optionkey: key }, { key: key, value: value })
  }

  getSelectedProgram() { return this._programCall('selected.get') }
  setSelectedProgram(program) { return this._programCall('selected.set', undefined, program) }

  getSelectedProgramOptions() { return this._programCall('selected.options.get') }
  setSelectedProgramOptions(options) { return this._programCall('selected.options.set', undefined, options) }

  getSelectedProgramOption(key) { return this._programCall('selected.option.get', { optionkey: option }) }
  setSelectedProgramOption(key, value) {
    return this._programCall('selected.option.set', { optionkey: option }, { key: key, value: value })
  }

  getAvailablePrograms() { return this._programCall('available.getList') }
  async getAvailableProgramOptions(key) {
    let result = await this._programCall('available.get', { programkey: key })
    return result.options
  }

  /************
   * SETTINGS *
   ************/

  async getSettings() {
    let list = await this._settingCall('getList')
    return list.reduce(
      (obj, item) => { let idx = item.key; obj[idx] = item.value; return obj }, {}
    )
  }
  getSetting(setting) { return this._settingCall('get', { settingskey: setting }) }

  setSetting(key, value) {
    if (key !== undefined || value !== undefined) {
      return this._settingCall('set', { settingskey: key }, { key: key, value: value })
    } else {
      return Promise.reject('key/value missing')
    }
  }

  /**********
   * STATUS *
   **********/

  async getStatus(force) {
    if (!this.details.connected) {
      return Promise.reject('device is offline')
    }
    let result = Promise.resolve(this.status)
    if (Object.keys(this.status).length === 0 || force) {
      try {
        result = await this.api._executeCall(bsh.api.status.getList, { haid: this.haId })
        result = appliance._parseResult(result)
        if (result !== undefined) {
          for (let i in result) {
            let pair = result[i]
            this.status[pair.key] = pair.value
          }
          result = this.status
        } else {
          result = Promise.reject('invalid format')
        }
      } catch(err) {
        result = err
      }
    }
    return result
  }

  /**********
   * EVENTS *
   **********/

  /**
   * Open the event stream for the appliance and receive event updates
   * @event appliance#connected - Fired on (dis-)connect events
   *   @type {boolean} - true if connected, false if disconnected
   * @event {string} appliance#event
   *   @type {object}
   *     @property {date} timestamp - date/time when the event occurred on the home appliance
   *     @property {string} type - The type of the event (STATUS|EVENT|NOTIFY)
   *     @property {object} raw - Raw object as received
   *     @property {string} summary - Summary of the event
   */
   // TODO: add interval timer to check alive status
   registerEvents() {
     let lastAlive = new Date()
     let source

     // The following events can be received:
     //   KEEP-ALIVE, STATUS, EVENT, NOTIFY, DISCONNECTED, CONNECTED
     // For STATUS, EVENT and NOTIFY, the "data" field is populated
     let processEvent = (msg) => {
      lastAlive = new Date()
      if (msg.type === 'CONNECTED' || msg.type === 'DISCONNECTED') {
        // connect or disconnect
        let result = msg.type === 'CONNECTED'
        this.details.connected = result
        this.emit('connected', result)
      } else if (msg.type === 'STATUS' || msg.type === 'EVENT' || msg.type === 'NOTIFY') {
        // data events
        let data = JSON.parse(msg.data)
        if (data !== undefined && data.items !== undefined) {
          let items = data.items
          for (let i in items) {
            let item = items[i]
            // The resulting object contains the data of the original object, plus:
            // type: type of event ('STATUS' / 'EVENT', / 'NOTIFY')
            // date: Javascript date object of the timestamp
            // summary: a summary string of the event
            let result = {
              type: msg.type,
              date: new Date(1000 * item.timestamp)
            }
            if (msg.type === 'STATUS') {
              // Update local status
              this.status[item.key] = item.value
            }
            // Interpret the message and create a summary
            let last_key = item.key.split('.').pop() + '='
            // Process values with a unit
            if (item.unit !== undefined) {
              if (item.unit === 'seconds') {
                let time = new Date(1000 * item.value)
                result.summary = last_key + time.toISOString().substr(11, 8)
              } else {
                result.summary = last_key + item.value + item.unit
              }
            } else {
              let value = item.value
              if (typeof value === 'string') {
                value = item.value.split('.').pop()
              }
              result.summary = last_key + value
            }
            result = Object.assign(item, result)
            //console.log('[' + msg.type + '] ' + this.details.name +': ' + result.summary)
            this.emit('event', result)
          }
        }
      }
     }

     let openStream = () => {
       let header = { headers: { Authorization: 'Bearer ' + this.api.access_token } }
       this.eventSource = new EventSource(this.api.baseUrl + bsh.expandUrl(bsh.api.events.url, { haid: this.haId }), header)

       // Error handling
       this.eventSource.onerror = (err => {
         if (err.status !== undefined) {
           console.log('Error (' + this.haId + ')', err)
          if (err.status === 401) {
            // Most likely the token has expired, try to refresh the token
            this.api.refreshTokens()
              .then(() => {
                console.log('Token refreshed')
                // We might have missed a STATUS or (DIS)CONNECT event, get current state
                this.getDetails().catch(err => { throw new Error(err) })
                this.getStatus().catch(err => { throw new Error(err) })
              })
              .catch(err => { // token refresh failed
                throw(new Error(err))
              })
          } else {
            throw(new Error(err.status))
          }
        }
      })
      this.eventSource.addEventListener('STATUS', (e) => processEvent(e), false)
      this.eventSource.addEventListener('NOTIFY', (e) => processEvent(e), false)
      this.eventSource.addEventListener('EVENT', (e) => processEvent(e), false)
      this.eventSource.addEventListener('CONNECTED', (e) => processEvent(e), false)
      this.eventSource.addEventListener('DISCONNECTED', (e) => processEvent(e), false)
      this.eventSource.addEventListener('KEEP-ALIVE', () => lastAlive = new Date(), false)
    }

    // Open the event stream
    openStream()

    // Check every 80 seconds if we still get messages
    this.eventInterval = setInterval(() => {
      let now = new Date()
      if (now - lastAlive >= 80000) {
        this.api.debug(now, "No message received from " + this.getName() + " in the last 80 seconds. Restarting event stream.")
        this.eventSource.close()
        openStream()
      }
    }, 80000)
  }

  /**
   * Close the event stream for the appliance and stop receive=ing event updates
   */
  unregisterEvents() {
    clearInterval(this.eventInterval)
    this.eventSource.close()
  }
}

module.exports = appliance
