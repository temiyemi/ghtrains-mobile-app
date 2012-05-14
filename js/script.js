var app_url = 'http://localhost:3080/api';
var store = window.localStorage;

var urls = {
    data     : app_url + '/data',
    feedback : app_url + '/feedbacks',
    tickets  : app_url + '/tickets',
    account  : app_url + '/accounts'
};

var app = {
    account  : {},
    data     : {},
    feedback : {},
    tickets  : {}
};

AppInstance = function(prop, value){
    this.app = {
        account  : app.account,
        data     : app.data,
        feedback : app.feedback,
        tickets  : app.tickets
    };
    // delete this.app[prop];
    this.app[prop] = value;
    store.setItem('app', JSON.stringify(this.app));
    // console.log(JSON.parse(store.getItem('app')));
};

if (Modernizr.localstorage) {
    if (store.getItem('app')) {
        app = JSON.parse(store.getItem('app'));
    }
}

/*
Variables for creating new Tickets, Feedback
 */
Ticket = function(){

};


/*
Variables for Live Progress & Train Schedules
 */

Progress = function(){
    this.now = new Date();
    this.show = function(schedule){
        schedule.departs_at;
        schedule.arrives_at;


    };
    this.compare = function(time){
        var now = new Date(time);
        now.setUTCFullYear(this.now.getUTCFullYear(), this.now.getUTCMonth(), this.now.getUTCDate());
        if (now.getTime() > this.now.getTime()){

        };
    };
    
};

$.each(['account','data','feedback','tickets'], function(a, b){
    app.watch(b, function(prop, oldval, newval){
        console.log('Watching app.'+ prop);
        new AppInstance(prop, newval);
        return newval;
    });
});

var resync = {
    account  : function(json) { app.account = json },
    data     : function(json) { app.data = json },
    feedback : function(json) { app.feedback = json },
    tickets  : function(json) { app.tickets = json }
};

$(document).on('ready',function(){

    $('div#settings').on('submit','form',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        $.ajax({
            url: urls.account+'?callback=?',
            type: 'POST',
            dataType: 'jsonp',
            data: $(this).serialize(),
            success: resync.account
        }).complete(function(){
            $('input[name="user[app_key]"]').val(app.account.app_key);
            $.mobile.changePage($('div#index'));
        });
    });

    $('div#feedback-new').on('submit','form',function(e){
        e.preventDefault();
        e.stopImmediatePropagation();
        $.ajax({
            url: urls.feedback +'/new?callback=?',
            type: 'POST',
            dataType: 'jsonp',
            data: $(this).serialize() + "&app_key="+app.account.app_key,
            success: resync.feedback
        }).complete(function(){
            $.mobile.changePage($('div#feedback'));
        });
        // should go back to the lists page on complete
    });


    // This is assumed to be first launch.
    // If there is no app_key set in Local DB,
    // Register user in the background and set user's app_key
    if (app.account.app_key === undefined){ $('div#settings form').submit(); }

    // console.log('DomReady:: Performing Remote Server API calls');
    // reset var data from remote server
    // $.getScript(urls.data, function(){});
    $.getJSON(urls.data+'?callback=?', resync.data);

    if (app.account !== null && app.account.app_key !== undefined) {
        // Get feedbacks history from remote server API
        $.getJSON(urls.feedback+'/'+app.account.app_key+'?callback=?', resync.feedback);
        // Get tickets history from remote server API
        $.getJSON(urls.tickets+'/'+app.account.app_key+'?callback=?', resync.tickets);
    }

});

$(document).on('pagecreate', 'div#routes', function () {

    $.each(app.data, function (i, o) {
        $('fieldset#route-choices')
            .append('<input type="radio" name="route-choice" id="route-choice-' + i + '" value="' + i + '"  />')
            .append('<label for="route-choice-' + i + '">' + o.name + '</label>')
        ;
    });

    $('fieldset#route-choices').on('change', 'input[name="route-choice"]', function () {
        $('fieldset#route-choices + div.center').remove();
        var $fieldset = $('<fieldset id="route-schedules" data-role="controlgroup" data-type="horizontal">');
        $.each(app.data[$(this).val()].scheduled_trips, function (i, o) {
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

    // $('input#route-choice-0').attr('checked','checked');

});

$(document).on('pagecreate', 'div#tickets', function () {

});

$(document).on('pagecreate', 'div#ticket-payment', function () {

});

$(document).on('pagecreate', 'div#ticket-detail', function () {

});

$(document).on('pagecreate', 'div#train-schedule', function () {
    if (!$('ul#all-routes').html())
    $.each(app.data, function (i, o) {
        $('ul#all-routes').append('<li><a href="" data="'+i+'">'+o.name+'</a></li>');
    });


    $('ul#all-routes li').on('click', 'a', function () {
        var route = app.data[$(this).attr('data')];
        $('div#train-schedule section').empty();
        var $schedule_set = $('<ul data-role="listview">');
        $.each(route.scheduled_trips, function (i, o) {
            $schedule_set
                .append('<li data-role="list-divider">Schedule '+ (i + 1) +
                    ' <span class="ui-li-count">'+(new Date(o.departs_at)).toTwelveHourTimeString() +
                    ' - '+ (new Date(o.arrives_at)).toTwelveHourTimeString() + '</span></li>');

            var terminals = route.name.split('-');
            $schedule_set.append('<li>'+terminals[0]+' <span class="ui-li-count">'+(new Date(o.departs_at)).toTwelveHourTimeString()+'</span></li>');
            $.each(o.stops, function (a, b) {
                $schedule_set
                    .append('<li>'+b.name+' <span class="ui-li-count">'+(new Date(b.arrives_at)).toTwelveHourTimeString()+'</span></li>');
            });
            $schedule_set.append('<li>'+terminals[1]+' <span class="ui-li-count">'+(new Date(o.arrives_at)).toTwelveHourTimeString()+'</span></li>');
        });
        $('div#train-schedule section').html($schedule_set);
        $('div#train-schedule').trigger('create');
    });

});

$(document).on('pagecreate pageshow','div#live-progress', function() {

    var now = new Date();

    if (!$('ul#all-routes-progress').html())
    $.each(app.data, function (i, o) {
        $('ul#all-routes-progress').append('<li><a href="" data="'+i+'">'+o.name+'</a></li>');
    });

    $('ul#all-routes-progress li').on('click', 'a', function () {
        var route = app.data[$(this).attr('data')];
        $('div#live-progress section').empty();
        var $schedule_set = $('<ul data-role="listview">');
        $.each(route.scheduled_trips, function (i, o) {
            // if now is btw depature - arrival time
            var terminals = route.name.split('-');

            $schedule_set.append('<li>'+
                '<div class="a"><span class="ui-li-count">'+(new Date(o.departs_at)).toTwelveHourTimeString()+'</span></div>'+
                '<div class="b"><span class="ui-li-count left">@</span></div>'+
                '<div class="c">'+terminals[0] +'</div></li>');

            $.each(o.stops, function (a, b) {
                $schedule_set
                    .append('<li>' +
                        '<div class="a"><span class="ui-li-count">'+(new Date(b.arrives_at)).toTwelveHourTimeString()+'</span></div>'+
                        '<div class="b"><span class="ui-li-count left">@</span></div>'+
                        '<div class="c">'+ b.name +'</div></li>'
                    )
                ;
            });

            $schedule_set.append('<li>'+
                '<div class="a"><span class="ui-li-count">'+(new Date(o.arrives_at)).toTwelveHourTimeString()+'</span></div>'+
                '<div class="b"><span class="ui-li-count left">@</span></div>'+
                '<div class="c">'+terminals[1] +'</div></li>');
        });
        $('div#live-progress section').html($schedule_set);
        $('div#live-progress').trigger('create');
    });
});

$(document).on('pagecreate', 'div#settings', function () {
    $.each(['name','email','number','app_key'], function(i, o){
        $('input[name="user['+o+']"]').val(app.account[o]);
    });
});

$(document).on('pagecreate pageshow', 'div#feedback', function () {
    $('div#feedback section').empty();
    var $ul = $('<ul data-role="listview">');
    $.each(app.feedback, function(i,o){
        var date = new Date(o.created_at);
        $ul.append('<li>' + o.message +'<span class="ui-li-count">'+ date.toTwelveHourTimeString() +'</span> ' +
            '<p class="ui-li-aside">' + date.toLocaleDateString() + ' </p>' +
            '</li>');
    });
    $('div#feedback section').html($ul);
    $('div#feedback').trigger('create');
});