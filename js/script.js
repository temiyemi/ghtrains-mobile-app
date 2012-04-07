// console.log('BeforeDomReady:: Initializing global variables');
var app_url = 'http://localhost:3000/api',
    urls = {
        data: app_url + '/data',
        feedback: app_url + '/feedback',
        tickets: app_url + '/tickets',
        account: app_url + '/accounts'
    };

var account = {},
    data = {},
    feedback = {},
    tickets = {};

$(document).on('ready',function(){
    // console.log('DomReady:: Performing Local Server API calls');
    // set var data from local DB
    // set var feedbacks from local DB
    // set var account from local DB
    // set var tickets from local DB

    // console.log('DomReady:: Performing Remote Server API calls');
    // reset var data from remote server
    //$.getScript(urls.data, function(){});
    $.getJSON(urls.data+'?callback=?', refreshData);

    if (account.app_key) {
        // Get feedbacks history from remote server API
        $.getJSON(urls.feedback+'/'+account.app_key+'&callback=?', refreshFeedback);
        // Get tickets history from remote server API
        $.getJSON(urls.tickets+'/'+account.app_key+'&callback=?', refreshTickets);
    }

});

$(document).on('pagecreate', 'div#routes', function () {
    // console.log('PageCreate:: Perform Page Context Actions');

    $.each(data, function (i, o) {
        $('fieldset#route-choices')
            .append('<input type="radio" name="route-choice" id="route-choice-' + i + '" value="' + i + '"  />')
            .append('<label for="route-choice-' + i + '">' + o.name + '</label>')
        ;
    });

    $('fieldset#route-choices').on('change', 'input[name="route-choice"]', function () {
        $('fieldset#route-choices + div.center').remove();
        // console.log(data[$(this).val()].scheduled_trips[0].stops);
        var $fieldset = $('<fieldset id="route-schedules" data-role="controlgroup" data-type="horizontal">');
            // $fieldset.append('<legend>Select Time:</legend>');
        $.each(data[$(this).val()].scheduled_trips, function (i, o) {
            var time = new Date(o.departs_at);
            $fieldset
               .append('<input type="radio" name="route-schedule" id="schedule-'+i+'" value="'+o.id+'" />')
               .append('<label for="schedule-'+i+'">'+time.toTwelveHourTimeString()+'</label>')
            ;
        });
        $('fieldset#route-choices').after(
            $('<div class="center">').append($fieldset)
        );
        $('div#routes').trigger('create');
    });

});

$(document).on('pagecreate', 'div#settings', function () {
    $('div#settings').on('submit','form',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        $.ajax({
            url: urls.account+'?callback=?',
            type: 'POST',
            dataType: 'jsonp',
            data: $(this).serialize(),
            success: refreshAccount
        }).complete(function(){ $('input[name="user[app_key]"]').val(account.app_key); });
    });
});



var refreshAccount = function(json){ account = json; };
var refreshData = function(json){ data = json };
var refreshFeedback = function(json) { feedback = json }
var refreshTickets = function(json) { tickets = json }