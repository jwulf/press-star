
$(function() {  
  $(".button").click(function() {  
    $('#result').html('Checking out book on server');
    $.get('/rest/1/addbook', {url: $('input[name="serverURL"]').val(), id: $('input[name="specID"]').val() }, 
    function(response){
        $('#result').html(response.msg);
    }).fail(function (err) {
            $('#result').html('There is a disturbance in the force. Error communicating with the server.');
    });   
      return false;
  });   
});  