'use strict'

const table = {
  // Main API
  api: {
    homeappliances: {
      getList: { url: '/homeappliances', http: 'get' },
      get: { url: '/homeappliances/{haid}', http: 'get' }
    },
    images: {
      getList: { url: '/homeappliances/{haid}/images', http: 'get' },
      get: { url: '/homeappliances/{haid}/images/{imagekey}', http: 'get' }
    },
    programs: {
      active: {
        stop: { url: '/homeappliances/{haid}/programs/active', http: 'delete' },
        get: { url: '/homeappliances/{haid}/programs/active', http: 'get' },
        start: { url: '/homeappliances/{haid}/programs/active', http: 'put' },
        options: {
          get: { url: '/homeappliances/{haid}/programs/active/options', http: 'get' },
          set: { url: '/homeappliances/{haid}/programs/active/options', http: 'put' }
        },
        option: {
          get: { url: '/homeappliances/{haid}/programs/active/options/{optionkey}', http: 'get' },
          set: { url: '/homeappliances/{haid}/programs/active/options/{optionkey}', http: 'put' }
        }
      },
      selected: {
        get: { url: '/homeappliances/{haid}/programs/selected', http: 'get' },
        set: { url: '/homeappliances/{haid}/programs/selected', http: 'put' },
        options: {
          get: { url: '/homeappliances/{haid}/programs/selected/options', http: 'get' },
          set: { url: '/homeappliances/{haid}/programs/selected/options', http: 'put' },
        },
        option: {
          get: { url: '/homeappliances/{haid}/programs/selected/options/{optionkey}', http: 'get' },
          set: { url: '/homeappliances/{haid}/programs/selected/options/{optionkey}', http: 'put' },
        }
      },
      available: {
        getList: { url: '/homeappliances/{haid}/programs/available', http: 'get' },
        get: { url: '/homeappliances/{haid}/programs/available/{programkey}', http: 'get' }
      }
    },
    settings: {
      getList: { url: '/homeappliances/{haid}/settings', http: 'get' },
      get: { url: '/homeappliances/{haid}/settings/{settingskey}', http: 'get' },
      set: { url: '/homeappliances/{haid}/settings/{settingskey}', http: 'put' }
    },
    status: {
      getList: { url: '/homeappliances/{haid}/status', http: 'get' },
      get: { url: '/homeappliances/{haid}/status/{statuskey}', http: 'get' },
    },
    events: { url: '/homeappliances/{haid}/events', http: 'get' }
  },
  // Expand the parameters into the URL
  expandUrl: ((url, params) => {
    url = '/api' + url
    for (let key in params) {
      url = url.replace('{' + key + '}', params[key])
    }
    return url
  }),
  // Available scopes
  scopes: {
    IdentifyAppliance: true,
    Monitor: true,
    Control: true,
    Images: true,
    Settings: true,
    '*': [ 'Monitor', 'Control', 'Images', 'Settings' ],
    Oven: [ 'Monitor', 'Control', 'Settings' ],
    Dishwasher: [ 'Monitor', 'Control', 'Settings' ],
    Washer: [ 'Monitor', 'Control', 'Settings' ],
    Dryer: [ 'Monitor', 'Control', 'Settings' ],
    FridgeFreezer: [ 'Monitor', 'Images', 'Settings' ],
    CoffeeMaker: [ 'Monitor', 'Control', 'Settings' ]
  },
  // Error codes
  errors: {
    '200':	{ resp: "OK", desc: "The request was successful. Typically returned for successful GET requests." },
    '204':	{ resp: "No Content", desc: "The request was successful. Typically returned for successful PUT/DELETE requests with no payload." },
    '400':	{ resp: "Bad Request", desc: "Error occurred (e.g. validation error - value is out of range)" },
    '401':	{ resp: "Unauthorized", desc: "No or invalid access token" },
    '403':	{ resp: "Forbidden", desc: "Scope has not been granted or home appliance is not assigned to HC account" },
    '404':	{ resp: "Not Found", desc: "This resource is not available (e.g. no images on washing machine)" },
    '405':	{ resp: "Method not allowed", desc: "The HTTP Method is not allowed for this resource" },
    '406':	{ resp: "Not Acceptable", desc: "The resource identified by the request is only capable of generating response entities which have content characteristics not acceptable according to the accept headers sent in the request." },
    '408':	{ resp: "Request Timeout", desc: "API Server failed to produce an answer or has no connection to backend service" },
    '409':	{ resp: "Conflict", desc: "Command/Query cannot be executed for the home appliance, the error response contains the error details" },
    '415':	{ resp: "Unsupported Media Type", desc: "The request's Content-Type is not supported" },
    '429':	{ resp: "Too Many Requests", desc: "E.g. the number of requests for a specific endpoint exceeded the quota of the client" },
    '500':	{ resp: "Internal Server Error", desc: "E.g. in case of a server configuration error or any errors in resource files" },
    '503':	{ resp: "Service Unavailable", desc: "E.g. if a required backend service is not available" }
  },
  enums: {
    'BSH.Common.EnumType.DoorState': {
      Open: 'The door of the home appliance is open.',
      Closed: 'The door of the home appliance is closed but not locked.',
      Locked: 'The door of the home appliance is locked.'
    },
    'BSH.Common.EnumType.EventPresentState': {
      Present: 'The event occurred and is present.',
      Off: 'The event is off.',
      Confirmed: 'The event has been confirmed by the user.'
    },
    'BSH.Common.EnumType.OperationState': {
      Inactive: 'Home appliance is switched off or in standby (only available for oven, dishwasher and coffee maker).',
      Ready: 'Home appliance is switched on. No program has been activated.',
      DelayedStart: 'A program has been activated but has not been started yet if a delayed start has been configured.',
      Run: 'A program is currently activated and runs.',
      Pause: 'An activated program has been paused.',
      ActionRequired: 'The activated program requires a user interaction.',
      Finished: 'The activated program has finished or has been aborted successfully.',
      Error: 'The home appliance is in an error state.',
      Aborting: 'The activated program is currently aborting.'
    },
    'BSH.Common.EnumType.PowerState': {
      Off: 'The home appliance switched to off state but can be switched on by writing the value BSH.Common.EnumType.PowerState.On to this setting.',
      On: 'The home appliance switched to on state. You can switch it off by writing the value BSH.Common.EnumType.PowerState.Off to this setting (only supported on ovens, dishwashers and coffee makers).',
      Standby: 'The home appliance went to standby mode. You can switch it on or off by changing the value of this setting appropriately.'
    },
    'LaundryCare.Washer.EnumType.Temperature': {
      Cold: 'Cold',
      GC20: '20 degrees celcius',
      GC30: '30 degrees celcius',
      GC40: '40 degrees celcius',
      GC50: '50 degrees celcius',
      GC60: '60 degrees celcius',
      GC70: '70 degrees celcius',
      GC80: '80 degrees celcius',
      GC90: '90 degrees celcius'
    },
    'LaundryCare.Washer.EnumType.SpinSpeed': {
      Off: 'The washer will not spin.',
      RPM400: 'The washer will spin with 400 rpm.',
      RPM600: 'The washer will spin with 600 rpm.',
      RPM800: 'The washer will spin with 800 rpm.',
      RPM1000: 'The washer will spin with 1000 rpm.',
      RPM1200: 'The washer will spin with 1200 rpm.',
      RPM1400: 'The washer will spin with 1400 rpm.',
      RPM1600: 'The washer will spin with 1600 rpm.',
    },
    'LaundryCare.Dryer.EnumType.DryingTarget': {
      IronDry: 'The dryer will stop drying if the clothes are iron dry.',
      CupboardDry: 'The dryer will stop drying if the clothes are cupboard dry.',
      CupboardDryPlus: 'The dryer will stop drying if the clothes are absolutly dry.'
    },
    'ConsumerProducts.CoffeeMaker.EnumType.BeanAmount': {
      Mild: 'Mild coffee',
      Normal: 'Normal coffee',
      Strong: 'Strong coffee',
      VeryStrong: 'Very strong coffee',
      DoubleShot: 'Extra strong coffee',
      DoubleShotPlus: 'Extra strong coffee is ground and brewed in two steps to reduce bitterness'
    },
    'ConsumerProducts.CoffeeMaker.EnumType.FillQuantity': { //EU min-max (step) values listed
      Espresso: '35-60 (5)',
      EspressoMacchiato: '40-60 (10)',
      Coffee: '60-250 (10)',
      Cappuccino: '100-300 (20)',
      LatteMacchiato: '200-400 (20)',
      CaffeLatte: '100-400 (20)'
    }
  }
}

module.exports = table
