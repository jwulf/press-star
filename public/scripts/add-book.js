

function addBook () {
    $.get('/rest/1/addbook', {url: $('input[name="serverURL"]').val(), id: $('input[name="specID"]').val() }, 
    function(response){
        $('#result').html(response.msg);
    });    
}