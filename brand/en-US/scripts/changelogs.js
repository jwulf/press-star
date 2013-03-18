function setUpChangeLogs(){
    $('.changelog-toggle').click(changelogClick);
	$('.changelog-toggle').each(function(){
		$(this).addClass('changelog-toggle-visible');
		$(this).html('<a href="#">' + $(this).html() + '</a>');
	});


	$('.changelog-items').find('li').find('div').each(function(){
		$(this).html('<a href="#" class="' + $($(this)).closest('div').attr('class') + '">' + $(this).html() + '</a>');
	});


	$('.changelog-items').find('li').find('a').click(changelogItemClick);
	
}

function changelogClick(e){
	e.preventDefault();

	var alreadyOpen = false,
		parentSection = $(this).closest('.section'); // Go up to the root of this topic
	
	// Check if this one is already open 
	$(parentSection).find('.changelog-items').each(function(){
		alreadyOpen = $(this).hasClass('changelog-visible');
	});

	// Close all the changelogs
	$(parentSection).find('.changelog-visible').removeClass('changelog-visible');
    
	// Open this one if it wasn't already open
	if ( ! alreadyOpen ) 
    {
		$(parentSection).find('.changelog-items').addClass('changelog-visible');
    } else { // otherwise turn off the highlights for this section
        $(parentSection).find('.changes-highlight').removeClass('changes-highlight');
    }
}

function changelogItemClick(e){
	e.preventDefault();

	var classes= {};
	
	$($(this).attr('class').split(' ')).each(function() { 
        if (this !== '') {
            classes[this] = this;
        }    
    });

    var alreadyClicked = $(this).hasClass('changes-highlight');
    
    $('.changes-highlight').removeClass('changes-highlight');
    
    if ( ! alreadyClicked ) {
        $(this).addClass('changes-highlight');
        for (var className in classes) {
            if (className.substring(0,10) === 'changelog-') {
                $('.' + 'changes-' + className.substring(10)).addClass('changes-highlight');
            }
        }
    }
}