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

To get a specific revision of a topic:

```js
pressgang.getTopicData('json', 8445, 10405, 
    function(err, result){
		console.log('The XML of revision 10405 is:' 
		+ result.xml;
	});
```

`isContentSpec` will return true if an ID is a Content Specification:

```js
pressgang.isContentSpec(456, 
	function(err, is){
		if (is) console.log('Topic 456 is a Content Specification')
	});    
```

`getContentSpec` returns a Content Spec object, which has the plain text content of the Content Spec, and a metadata record.
```js
pressgang.getContentSpec(456, 
    function(err, result){
		console.log(result.spec); // Plain-text of the spec
        console.log(result.metadata); // All the spec metadata in an object
	});    
```

You can change the logging level of the PressGangCCMS Object to get details for debugging. The `loglevel` defaults to 0. Higher levels produce more trace output on the console:

```js
pressgang.loglevel = 2;
```

##Source Code
The source is hosted on github at https://github.com/jwulf/node-pressgang-rest.

It's written using Microsoft TypeScript, and compiled to JavaScript using the node typescript module. There is a TypeScript declaration file in the module.
