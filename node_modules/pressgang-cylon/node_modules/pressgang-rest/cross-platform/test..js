var PG=require('./pressgangccms');

//console.log(pg.DEFAULT_URL);

var pg = new PG.PressGangCCMS('http://skynet.usersys.redhat.com:8080/TopicIndex');

//console.log(pg.restver);

pg.getTopicXML(33, function(err, result){console.log(result)});

//pg.isContentSpec(12339, function(err, result){console.log(result)});

//pg.getTopicData('topic_tags', 12339, function(err, result){console.log(result)});

/* pg.getSpec(12339, function(err, result){
    
    console.log(result.metadata);
    console.log(result.metadata.version);
    console.log(result.metadata.id);
    
    });
    
    */