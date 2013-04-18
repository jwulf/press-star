
$(function() {  
    // Bind event handlers
    
    // Disable the Add Book button when the Content Spec field is empty
    // Enable it when there is something in there
    $('#specid-input').keyup(function(){
        if ($('#specid-input').val() === '') {
            $('#add-button').attr('disabled', 'disabled');
        } else {
            $('#add-button').removeAttr('disabled');
        }
    });
    
  $("#add-button").click(function() {  
    $('#result').html('Checking out book on server').removeClass('alert-success').removeClass('alert-error').addClass('alert alert-info');
    $.get('/rest/1/addbook', {url: $('input[name="serverURL"]').val(), id: $('input[name="specID"]').val() }, 
    function(response){
        $('#result').html(response.msg);
        if (response.code === 0) $('#result').removeClass('alert-error').removeClass('alert-info').addClass('alert alert-success');
        if (response.code === 1) $('#result').removeClass('alert-info').removeClass('alert-success').addClass('alert');
    }).fail(function (err) {
            $('#result').html('There is a disturbance in the force. Error communicating with the server.');
            $('#result').addClass('alert alert-error');
    });   
      return false;
  });   
});  