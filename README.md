# bsh-api
NodeJS interface for the Bosch Siemens Home-Connect API.

### General
All functions return Promises.

### Usage
In order to use this library, a valid API KEY is needed. To acquire one, see https://developer.home-connect.com/.

In general all functions return objects or an array of objects.

##### Errors
The raw errors are returned in the promise rejection `detail` field of the object.

##### Example
Example code can be found in `test/home-connect.js`. You'll need to create a file named `api-key.js` in the same directory, which contains the API key.

Example `api-key.js`:
```js
module.exports = '<API key from developer portal>'
```

### Dependencies
This library make use of the 'request' and 'EventSource' packages.

### License
