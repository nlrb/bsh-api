'use strict'

const BSH = require('../index.js')
const request = require('request');
const api_key = require('./api-key.js')

// Get all the home appliances
let api = new BSH(api_key, undefined, undefined, 'IdentifyAppliance Monitor *-Control Settings');
api
	.on('newtokens', tokens => {
		console.log('New tokens received:', tokens)
	})
	.authorize()
		.then(code => api.getTokens(code)
			.then(result => api.getAppliances()
				.then(appliances => {
					for (let haId in appliances) {
						let appliance = appliances[haId];
						appliance.getDetails().then(details => {
							console.log(haId, details)
							appliance
								.on('connected', state => {
									let now = new Date();
									console.log(now + ' [CONNECT] ' + details.name + ': '+ (state ? 'CONNECTED' : 'DISCONNECTED'));
								})
								.on('event', data => {
									console.log(data.date + ' [' + data.type + '] ' + details.name + ': ' + data.summary);
								})
								.registerEvents();
							appliance.getStatus(true)
								.then(status => console.log(appliance.getName(), 'getStatus', status))
								.catch(err => console.log(appliance.getName(), 'getStatus ERROR:', err))
								appliance.getAvailablePrograms()
									.then(programs => {
										console.log(appliance.getName(), 'getAvailablePrograms', programs)
										programs.forEach(program => {
											// Check the options for each program
											appliance.getAvailableProgramOptions(program.key)
												.then(options => console.log(appliance.getName(), 'getAvailableProgram', program.key, options))
												.catch(err => console.log(appliance.getName(), 'getAvailableProgram ERROR:', err))
										})
									})
									.catch(err => console.log(appliance.getName(), 'getAvailablePrograms ERROR:', err))
							appliance.getActiveProgram()
								.then(result => console.log(appliance.getName(), 'getActiveProgram', result))
								.catch(err => {
									let txt = (err.nr === 404) ? 'No program active' : err
									console.log(appliance.getName(), 'getActiveProgram ERROR:', txt)
								})
							if (appliance.getType() === 'Dishwasher') {
								appliance.startActiveProgram({
									key: "Dishcare.Dishwasher.Program.Auto1",
								})
									.then(result => console.log(appliance.getName(), 'startActiveProgram', result))
									.catch(err => console.log(appliance.getName(), 'startActiveProgram ERROR:', err))
								appliance.setSetting('BSH.Common.Setting.PowerState', 'BSH.Common.EnumType.PowerState.Off')
									.then(result => console.log(appliance.getName(), 'setSetting', result))
									.catch(err => console.log(appliance.getName(), 'setSetting ERROR:', err))
							} else if (appliance.getType() === 'Oven') {
								appliance.startActiveProgram({
									key: "Cooking.Oven.Program.HeatingMode.HotAir",
							    options: [
							      {
							        "key": "Cooking.Oven.Option.SetpointTemperature",
							        "value": 230,
							        "unit": "°C"
							      }, {
							        "key": "BSH.Common.Option.Duration",
							        "value": 120,
							        "unit": "seconds"
							      }
							    ]
								})
								.then(result => {
									console.log(appliance.getName(), 'startActiveProgram', result)
									let stop = () => {
										appliance.stopActiveProgram()
											.then(result => console.log(appliance.getName(), 'stopActiveProgram', result))
											.catch(err => {
												console.log(appliance.getName(), 'stopActiveProgram ERROR:', err)
											})
									}
									setTimeout(stop, 15000)
								})
								.catch(err => {
									console.log(appliance.getName(), 'startActiveProgram ERROR:', err)
								})
							} else if (appliance.getType() === 'FridgeFreezer') {
								appliance.getImages()
									.then(imgs => console.log(appliance.getName(), 'getImages:', imgs))
									.catch(err => console.log(appliance.getName(), 'getImages ERROR:', err))
							}
						})
					}
				})
			)
		)
		.catch(err => console.log(err))
