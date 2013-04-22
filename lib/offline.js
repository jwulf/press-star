/*
    This takes the Death Star offline and puts it back online, synchronizing
    the topics with the PressGang repository.
    
    Off-line operation is achieved by creating a local cache of topics, and 
    directing all topic load and save operations to the local cache when the 
    Death Star is offline.
    
    The topicdriver.js file contains the topic driver that directs push and pull
    operations to the appropriate source.
    
    When books are built, the revision of the Content Spec used to build them
    is added to the Book metadata.
    


*/