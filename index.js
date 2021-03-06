'use strict'

const bsh = require('./lib/bsh-const.js')
const bshAppliance = require('./lib/bsh-appliance.js')
const request = require('request')
const EventEmitter = require('events')

const debug = console.log

var generateError = (code => { return {
  nr: code,
  error: bsh.errors[code].resp || 'Unknown',
  text: bsh.errors[code].desc || 'Unknown'
}})

// Check whether a given scope is valid or throw an error
function bshCheckScope(scope) {
  let newScope = scope.split(' ')
  for (let i in newScope) {
    if (bsh.scopes[newScope[i]] === undefined) {
      let sub = newScope[i].split('-')
      if (sub[0] !== undefined) {
        if (bsh.scopes[sub[0]] === undefined || bsh.scopes[sub[0]].find(x => x === sub[1]) === undefined) {
          throw(new Error('unknown scope: ' + newScope[i]))
          delete newScope[i]
        }
      }
    }
  }
  return newScope.join(' ')
}

/** Main class for the Home-Connect API */
class BSH extends EventEmitter {
  /** Create a new API instance
   * @constructor
   * @param {string} client - The client API key, as found on the developer portal
   * @param {string} url - The base URL (excluding end '/')
   * @param {string} redirect - The redirect URL, as registered on the developer portal
   * @param {string} scope - Space separated string with the requested access scope
   */
  constructor(client, url, redirect, scope) {
    super()
    this.debug = debug
    this.client = client
    this.baseUrl = url || 'https://simulator.home-connect.com/'
    this.redirect = redirect || 'https://apiclient.home-connect.com/o2c.html'
    this.scope = bshCheckScope(scope || 'IdentifyAppliance Monitor')
    this.access_token
    this.refresh_token
    this.state_token
    this.appliances
  }

  /**
   * Provides Home-Connect defined authentication URL with parameters
   * @returns {string} OUath2 authorization URL
   */
  getAuthUrl() {
    this.state_token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16)
    })

    let params = [
      'client_id=' + this.client,
      'redirect_uri=' + this.redirect,
      'response_type=code',
      'scope=' + this.scope,
      'state=' + this.state_token
    ]
    return this.baseUrl + '/security/oauth/authorize' + '?' + params.join('&')
  }

  /**
   * Request Oauth2 autorization code
   * @param {string} auth_url - authorization url (if not provided, will be generated with getAuthUrl)
   * @returns {string} - received 'code'
   */
  authorize(auth_url) {
    return new Promise((resolve, reject) => {
      let url = auth_url || this.getAuthUrl()
      console.log(url)
  		request
        .get({ url: url })
  			.on('error', (err) => reject(err))
  			.on('response', (resp) => {
          if (resp.statusCode === 200) {
            let redirect = resp.request.href
            let err = redirect.indexOf('error=')
            if (err >= 0) {
              reject(decodeURI(redirect.slice(err)))
            } else {
              let result = redirect.match(/code=([^\&]*)/)[1]
              if (this.state !== undefined) {
                let state = redirect.match(/state=([^\&]*)/)[1]
                if (state !== this.state) {
                  reject(new Error('Invalid state returned'))
                }
              }
              resolve(result)
            }
          } else {
            reject(new Error('Invalid response ' + resp.statusCode))
  				}
  		})
  	})
  }

  /**
   * Request a new access token or refresh the token
   * @param {string} refresh - refresh token, if undefined a new access token will be requested
   * @returns {object} - an object containing access & refresh token
   */
  getTokens(refresh) {
    return new Promise((resolve, reject) => {
      let form = {
        client_id: this.client,
    		redirect_uri: this.redirect
      }
      if (refresh === undefined) {
        // refresh token request
        form.grant_type = 'refresh_token'
        form.refresh_token = this.refresh_token
      } else {
        // access token request
    		form.grant_type = 'authorization_code'
    		form.code = refresh
      }
  		request
  			.post({ url: this.baseUrl + '/security/oauth/token', form: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }})
  			.on('error', (err) => {
          this.emit('token.invalid')
					reject(new Error(err))
  			})
  			.on('response', resp => {
  				resp.on('data', (data) => {
  					let result = JSON.parse(data.toString())
            if (resp.statusCode === 200) {
              if (result.access_token !== undefined && result.refresh_token !== undefined) {
                this.access_token = result.access_token
                this.refresh_token = result.refresh_token
                let now = new Date()
                let valid = Number(result.expires_in)
                result.requested = now
                result.expires = new Date(now.getTime() + valid * 1000)
                delete result.id
                delete result.expires_in
                this.emit('token.available', result)
                resolve(result)
              } else {
                this.emit('token.invalid')
                reject(new Error('Invalid reply'))
              }
            } else {
              this.emit('token.invalid')
              reject(new Error(result.error + ' (' + result.error_description + ')'))
            }
          })
				})
  	})
  }

  /** Refresh the access token */
  refreshTokens() {
    this.debug('Token refresh')
    return this.getTokens()
  }

  /** Override the access and refresh tokens */
  setTokens(access, refresh) {
    this.access_token = access
    this.refresh_token = refresh
  }

  /**
   * Get data from the home-connect server (get calls only)
   * @param {object} api - the api part of the URL to call, e.g. '/api/homeappliances' and the call type
   * @param {object} params - the parameters that will be substituted in the URL
   * @param {string} body - optional body for the request
   * @returns {Promise} - result of the call
   */
  async _executeCall(api, params, body) {
    return new Promise((resolve, reject) => {
      // Check if there is a valid access token
      if (this.access_token === undefined) {
        reject(new Error('No token set'))
      }
      // Expand the parameters into the URL
      let url = this.baseUrl + bsh.expandUrl(api.url, params)
      // Make an HTTP request (get, put, delete)
      let func = eval('request.' + api.http)
  		func({ url: url, body: body, headers:
        { 'Accept': 'application/vnd.bsh.sdk.v1+json',
          'Content-Type': 'application/vnd.bsh.sdk.v1+json'
        }
      }).auth(null, null, true, this.access_token)
  			.on('error', (err) => reject(err))
  			.on('response', (resp) => {
          if (resp.statusCode === 204) {
            resolve('{ "data": "OK" }') // always return JSON
          }
  				resp.on('data', (data) => {
            let result = data.toString()
            if (resp.statusCode !== 200) {
              if (resp.statusCode === 401) { // token has expired? refresh token
                this.refreshTokens()
                  .then(resolve(this._executeCall(api, params, body)))
                  .catch(err => { // token refresh failed
                    reject(err)
                  })
              } else {
                let err = generateError(resp.statusCode)
                try {
                  result = JSON.parse(result)
                  err.detail = result.error || result
                } catch (e) {
                  err.detail = result
                }
    					  reject(err)
              }
    				} else {
    					resolve(result)
    				}
          })
  		  })
  	})
  }

  /**
   * Return the (promise of) list of appliances
   * @param {boolean} force - false: read from cache; true: read from server
   * @returns {Promise} - An array with appliance objects
  */
  async getAppliances(force) {
    try {
      let result
      if (this.appliances === undefined || force) {
        result = await this._executeCall(bsh.api.homeappliances.getList)
        result = JSON.parse(result)
        if (result.data !== undefined && result.data.homeappliances !== undefined) {
          result = await result.data.homeappliances.reduce(
            (obj, item) => { let idx = item.haId; delete item.haId; obj[idx] = new bshAppliance(this, idx, item); return obj }, {}
          )
        } else {
          result = Promise.reject('invalid format')
        }
        this.appliances = result
      } else {
        result = Promise.resolve(this.appliances)
      }
      return result
    } catch(err) {
      return Promise.reject(err)
    }
  }

  /**
   * Return the (promise of) list of appliances
   * @param {string} haId - Home Appliance identifier
   * @returns {Promise} - An array with appliance objects
  */
  async getAppliance(haId) {
    if (this.appliance !== undefined && this.appliance[haId] !== undefined) {
      return Promise.resolve(this.appliances[haId])
    } else {
      try {
        let result = await this.getAppliances(true)
        if (result[haId] === undefined) {
          return Promise.reject('Unknown appliance')
        } else {
          return Promise.resolve(result[haId])
        }
      } catch(err) {
        return Promise.reject(err)
      }
    }
  }

}

module.exports = BSH
