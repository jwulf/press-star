var oldBookList;

function indexRefresh (){
 window.refreshTimer = setInterval(function() {
     $.get(window.sourceURL, {}, function(result) {
         if (result != oldBookList) {
             $('#booklist').html(result);
             oldBookList = result;
         }
     });
    }, 1000);   
}

function pageSetup () {
    indexRefresh();
}

function rebuild (url, id) {
    $.get('/rest/1/build', {url: url, id: id}, function (result){
        console.log(result); 
    });
}

function rebuildAll () {
    $.get('/rest/1/rebuildAll', {}, function(result){
        console.log(result);
    });
}