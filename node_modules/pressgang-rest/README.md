#node-pressgang-rest

A node module that provides a REST client library for the PressGang CCMS. It provides a more semantic interface for application development than the raw PressGang REST interface. Uses restler for the REST interface.

##Installation

```bash
npm install pressgang-rest
```
## Basic Usage

First, require `pressgang-rest`:

```js
var PressGangCCMS = require('pressgang-rest').PressGangCCMS;
```
Next, create a new PressGangCCMS object:

```js
var pressgang = new PressGangCCMS('http://127.0.0.1:8080/TopicIndex');
```

Now, you can get the XML of a topic:

```js
pressgang.getTopicData('xml', 8445, 
	function(err, result){
		console.log('The topic xml content is:' + result);
	});
```

To get the JSON representation of a topic:

```js
pressgang.getTopicData('json', 8445, 
	function(err, result){
		console.log('The JSON representation of the topic is:' 
		+ JSON.Stringify(result);
	});
```

`isContentSpec` is an example of a more semantic interface to PressGang:

```js
pressgang.isContentSpec(456, 
	function(err, is){
		if (is) console.log('Topic 456 is a Content Specification')
	});
```

You can change the logging level of the PressGangCCMS Object to get details for debugging. The `loglevel` defaults to 0. Higher levels produce more trace output on the console:

```js
pressgang.set('loglevel', 2);
```
