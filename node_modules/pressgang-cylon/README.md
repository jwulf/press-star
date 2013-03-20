#node-pressgang-cylon-processor

A node module that provides a pure JavaScript re-implementation PressGang CCMS Content Spec Processor functionality. "Why?" I hear you ask. This reimplementation provides Content Spec Processor functionality as a library, so that you can hook all kinds of weird and wonderful things into the processing.

##Installation

```bash
npm install pressgang-cylon
```
## Basic Usage

First, require `pressgang-cylon`:

```js
var cylon = require('pressgang-cylon');
```

The Cylon Processor implements `csprocessor checkout`:

```js
var url = 'http://pressgang.server.com:8080/TopicIndex';
var id = 8432;
var dir = '/opt/checkouts'

cylon.checkout(url, id, dir, 
	function(err, md){
		if (err) { 
			console.log(err) 
		} else { 
			console.log('Successfully checked out %s to %s',
				md.title, md.bookdir);
	}
});
 ```
The callback function receives a Content Specification metadata object with all the metadata from the Content Specification. This is useful if you want to generate an index of checked out books. 

You can extract the metadata from a Content Specification using `getSpecMetadata`:

```js
cylon.getSpecMetadata(url, id, 
	function(err, md){
		if (err) { 
			console.log(err); 
		} else { 
			console.log(md); 
		}
	}
); 
```

You can get a Content Specification with `getSpec`:

```js
cylon.getSpec(url, id,
	function(err, spec){
		if (err) 
			{ console.log(err); } 
		else
			{ console.log(spec); }
	}
); 
```

