/** Local variable for in-browser HTML5 LocalStorage */
var store = window.localStorage;

/** Define URLs to Server API */
var base_url = 'http://0.0.0.0:3080/api';
var urls = {
    data:      base_url + '/data',
    feedback:  base_url + '/feedbacks',
    tickets:   base_url + '/tickets',
    account:   base_url + '/accounts'
};

/** Declare Singleton global variable for app */
var app = {
    account: {},
    data:    {},
    feedback:{},
    tickets: {},
    payment: { mobileMoneyNumber:null }
};

/** Declare instance class to clone app */
var AppInstance = function (prop, value) {
    this.app = {
        account:app.account,
        data:app.data,
        feedback:app.feedback,
        tickets:app.tickets,
        payment:app.payment
    };
    this.app[prop] = value;
    store.setItem('app', JSON.stringify(this.app));
};

/* Declare Singleton global variable for passing data through screens */
var selected = { ticket: null };

if (Modernizr.localstorage) {
    if (store.getItem('app')) {
        app = JSON.parse(store.getItem('app'));
    }
}

$.each(['account', 'data', 'feedback', 'tickets', 'payment'], function (index, object) {
    app.watch(object, function (prop, oldval, newval) {
        // console.log('Watching app.' + prop);
        new AppInstance(prop, newval);
        return newval;
    });
});

var resync = {
    account: function (json) { app.account = json },
    data: function (json) { app.data = json },
    feedback: function (json) { app.feedback = json },
    tickets: function (json) { app.tickets = json }
};

/** This is like a cron for updating tickets status */
var cron = {
    ready : false,
    run : function(){
        var now = new Date,
            tickets = new Array;
        $.each(app.tickets, function(i,ticket) {
            // if status is active and arrival time of train is past now
            if (ticket.status == 'active') {
                var weight = (new Date(ticket.schedule.arrives_at)).getHours() * 60
                        + (new Date(ticket.schedule.arrives_at)).getMinutes(),
                    Weight = now.getHours() * 60 + now.getMinutes();

                if (Weight > weight) tickets.push(ticket.id);
            };
        });
        if (tickets.length > 0) {
            $.ajax({
                url:urls.tickets + '/edit/' + tickets.join(',') + '?callback=?',
                dataType:'jsonp',
                data:"status=used&app_key=" + app.account.app_key,
                success:resync.tickets
            }).complete(function(){cron.ready=false});
        };
    }
};

cron.watch('ready', function(prop,oldVal,newVal) {
    console.log('watching cron: ready ' + cron.ready);
    if (newVal !== true) {
    } else new cron.run();
    return newVal;
});

$(document).on('ready', function () {

    $('div#settings').on('submit', 'form', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $.ajax({
            url:urls.account + '?callback=?',
            dataType:'jsonp',
            data:$(this).serialize(),
            success:resync.account
        }).complete(function () {
            $.mobile.changePage($('div#index'));
        });
    });

    $('div#feedback-new').on('submit', 'form', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        $.ajax({
            url:urls.feedback + '/new?callback=?',
            dataType:'jsonp',
            data:$(this).serialize() + "&app_key=" + app.account.app_key,
            success:resync.feedback
        }).complete(function () {
            $.mobile.changePage($('div#feedback'));
        });
    });

    // On 1st launch: if no app.account.app_key in LocalStorage,
    // then register user and set user's app_key
    if (typeof app.account.app_key === undefined) {
        $('div#settings form').submit();
    }

    // Pre-load necessary data from server

    //: Trains schedules, Routes  etc
    $.getJSON(urls.data + '?callback=?', resync.data);

    if (app.account !== null && app.account.app_key !== undefined) {
        //: User's feedback
        $.getJSON(urls.feedback + '/' + app.account.app_key + '?callback=?', resync.feedback);
        //: User's tickets
        $.getJSON(urls.tickets + '/' + app.account.app_key + '?callback=?', resync.tickets);
    }

});

$(document).on('pageshow', 'div#index', function () {
    $('#ticket-count').html(app.tickets.length);
    $('#feedback-count').html(app.feedback.length);
});

$(document).on('pagecreate', 'div#routes', function () {

    $.each(app.data, function (i, o) {
        $('fieldset#route-choices')
            .append('<input type="radio" name="route" id="route-choice-' + i + '" value="' + i + '"  />')
            .append('<label for="route-choice-' + i + '">' + o.name + '</label>')
        ;
    });

    $('fieldset#route-choices').on('change', 'input[name="route"]', function () {
        $('fieldset#route-choices + div[data-role]').remove();
        var $fieldset = $('<fieldset id="route-schedules" data-role="controlgroup" data-type="horizontal">');
        $.each(app.data[$(this).val()].scheduled_trips, function (i, o) {
            $fieldset
                .append('<input type="radio" name="schedule" id="schedule-' + i + '" value="' + o.id + '" />')
                .append('<label for="schedule-' + i + '">' + (new Date(o.departs_at)).toTwelveHourTimeString() + '</label>')
            ;
        });
        $('fieldset#route-choices').after(
            $('<div data-role="collapsible" data-collapsed="false" data-content-theme="a">')
                .append($fieldset)
                .prepend('<h3>Choose Departure Time</h3>')
        );
        $('div#routes').trigger('create');
    });

});

$(document).on('pageshow', 'div#tickets', function () {
    cron.ready = true;
    var $ul = $('<ul data-role="listview" data-split-icon="delete" data-split-theme="e">');
    $.each(app.tickets, function (i, o) {
        var $li = '<a href="#ticket-detail"><h3>#' + o.number + '#</h3>' +
            '<p><strong>' + o.route.name + '</strong> @ <strong>' +
            (new Date(o.schedule.departs_at)).toTwelveHourTimeString() +
            '</strong></p>';
        if (o.status.toLowerCase() != 'used') $li += '<span class="ui-li-count">' + o.status + '</span>';
        $li += '</a>';
        if (o.status.toLowerCase() == 'used')
            $li += '<a href="#delete-ticket" data-rel="dialog" data-transition="pop">Delete</a>';
        $ul.append('<li data-ticket-index="' + i + '">' + $li + '</li>');
    });
    $('div#tickets section').html($ul);
    $('div#tickets').trigger('create');
    $('div#tickets section ul').on('click', 'a', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();
        selected.ticket = app.tickets[$(this).parents('li').jqmData('ticket-index')];
        // forward to intended screen
        $.mobile.changePage($($.mobile.path.parseUrl(this.href).hash));
    });
});

$(document).on('pageshow', 'div#ticket-payment', function () {

    // If there's phone number in the account, number as mobile money number
    if (isNaN(app.payment.mobileMoneyNumber)) {
        $('input[name="mobile_money_number"]').val(app.payment.mobileMoneyNumber);
    };

    $('div#ticket-payment').on('click tap', 'a#pay', function (e) {
        e.preventDefault();
        e.stopImmediatePropagation();

        var mobile = $('input[name="mobile_money_number"]').val();

        if ($('input#set-default').checked) {
            app.payment = { mobileMoneyNumber: mobile };
        }

        // send the chosen schedule_id, with the app_key and the mobile_money_number
        var schedule_id = (function () {
            var id = null;
            $('input[id^="schedule-"]').each(function () {
                if (this.checked == true) id = this.value;
            });
            return id;
        })();

        var data = "ticket[schedule_id]=" + schedule_id +
            "&app_key=" + app.account.app_key +
            "&mobile_account=" + mobile;

        $.ajax({
            url:urls.tickets + '/new?callback=?',
            dataType:'jsonp',
            data:data,
            success:resync.tickets
        }).complete(
            function () {
                selected.ticket = app.tickets[0];
                $.mobile.changePage($('div#ticket-payment-ok'), { transition:"slideup"});
            }
        ).fail(function () {
                $.mobile.changePage($('div#ticket-payment-fail'), { transition:"slidedown"});
            }
        );
    });
});

$(document).on('pageshow', 'div#ticket-detail', function () {
    // grab selected ticket
    $('div#ticket-detail section').empty();
    var ticket = selected.ticket,
        $details = '<table><thead><tr><td colspan="2">#' + ticket.number + '#</td></tr></thead><tbody>',
        ts = {
            created:new Date(ticket.created_at),
            updated:new Date(ticket.updated_at)
        };

    $details += '<tr><td>Route:</td> <td>' + ticket.route.name + '</td></tr>'
        + '<tr><td>Train:</td> <td>' + ticket.train.number + '</td></tr>'
        + '<tr><td>Departure Time:</td> <td>' + (new Date(ticket.schedule.departs_at)).toTwelveHourTimeString() + '</td></tr>'
        + '<tr><td>Arrival Time:</td> <td>' + (new Date(ticket.schedule.arrives_at)).toTwelveHourTimeString() + '</td></tr>'
        + '</tbody><tfoot>'
        + '<tr><td colspan="2">This ticket was purchased on ' + ts.created.toLocaleDateString()
        + ' @' + ts.created.toTwelveHourTimeString() + '</td></tr>'
    ;

    if (ticket.status != 'new') {
        var status = ticket.status == 'active' ? 'activated' : 'used';
        $details += '<tr><td colspan="2">And ' + status + ' on ' + ts.updated.toLocaleDateString()
            + ' @' + ts.updated.toTwelveHourTimeString() + '</td></tr>';
    } else {
        $details += "<tr><td colspan='2'>You have not activated or used this ticket. "
            + "<br />Push the 'Activate Now' button below to use this ticket only when boarding the train!</td></tr>"
            + '<tr><td colspan="2"><button>Activate Now</button></td></tr>';
    }

    $details += '</tfoot></table>';

    $('div#ticket-detail section').html($details);
    $('div#ticket-detail').trigger('create');

    $('div#ticket-detail section').on('click', 'button', function (evt) {
        evt.stopImmediatePropagation();
        // Activate Ticket
        $.ajax({
            url:urls.tickets + '/edit/' + ticket.id + '?callback=?',
            dataType:'jsonp',
            data:"app_key=" + app.account.app_key + "&status=active",
            success:resync.tickets
        }).complete(function () {
                selected.ticket.status = 'active';
                ticket.status = 'active';
                $("div#ticket-detail section button").html('Activated').prop('disabled', true).button("refresh");
                cron.ready = true;
            }
        );
    });
});

$(document).on('pagecreate', 'div#train-schedule', function () {

    if (!$('ul#all-routes').html())
        $.each(app.data, function (i, o) {
            $('ul#all-routes').append('<li><a href="" data="' + i + '">' + o.name + '</a></li>');
        });

    $('ul#all-routes li').on('click', 'a', function () {
        var route = app.data[$(this).attr('data')];
        $('div#train-schedule section').empty();
        var $schedule_set = $('<ul data-role="listview">');
        $.each(route.scheduled_trips, function (i, o) {
            $schedule_set
                .append('<li data-role="list-divider">Schedule ' + (i + 1) +
                ' <span class="ui-li-count">' + (new Date(o.departs_at)).toTwelveHourTimeString() +
                ' - ' + (new Date(o.arrives_at)).toTwelveHourTimeString() + '</span></li>');

            var terminals = route.name.split('-');
            $schedule_set.append('<li>' + terminals[0] + ' <span class="ui-li-count">' + (new Date(o.departs_at)).toTwelveHourTimeString() + '</span></li>');
            $.each(o.stops, function (a, b) {
                $schedule_set
                    .append('<li>' + b.name + ' <span class="ui-li-count">' + (new Date(b.arrives_at)).toTwelveHourTimeString() + '</span></li>');
            });
            $schedule_set.append('<li>' + terminals[1] + ' <span class="ui-li-count">' + (new Date(o.arrives_at)).toTwelveHourTimeString() + '</span></li>');
        });
        $('div#train-schedule section').html($schedule_set);
        $('div#train-schedule').trigger('create');
    });

    $('ul#all-routes li:first-child a').click();

});

$(document).on('pagecreate pageshow', 'div#live-progress', function () {

    if (!$('ul#all-routes-progress').html())
        $.each(app.data, function (i, o) {
            $('ul#all-routes-progress').append('<li><a href="" data="' + i + '">' + o.name + '</a></li>');
        });


    $('ul#all-routes-progress li').on('click', 'a', function () {
        $('div#live-progress section').empty();
        var $schedule_set = $('<ul data-role="listview">'),
            route = app.data[$(this).attr('data')],
            now = new Date,
            moving = false;

        var schedule = (function(schedules){
            var current = new Array;
            $.each(schedules,function(i,o){
                if ((new Date(o.departs_at)).getHours() <= now.getHours()
                    && (new Date(o.arrives_at)).getHours() >= now.getHours()) {
                    moving = true;
                    current.push(o);
                }
                else {
                    if ((new Date(o.departs_at)).getHours() > now.getHours()) {
                        current.push(o);
                    }
                }
            });
            if (current.length == 0) return schedules[0];
            return current[0];
        })(route.scheduled_trips);

        var status = function(time,terminus) {
            var Time = new Date(time),
                weight = Time.getHours() * 60 + Time.getMinutes(),
                Weight = now.getHours() * 60 + now.getMinutes();
            if (terminus == 'departure') {
                if (!moving) return 'to depart';
                if (weight < Weight) return 'departed';
                if (weight == Weight) return 'departing';
                if (weight > Weight) return 'to depart';
            } else if (terminus == 'arrival') {
                if (!moving) return 'to arrive';
                if (weight <= Weight) return 'arrived';
                else return 'to arrive';
            } else {
                if (!moving) return 'stops by';
                if (weight < Weight) return 'left';
                if (weight == Weight) return 'at';
                if (weight > Weight) return 'stops by';
            }
        };

        (function (o) {

            if (!moving) $schedule_set.append('<li data-role="list-divider">Next train departs at '+ (new Date(o.departs_at)).toTwelveHourTimeString() +'</li>');

            var terminals = route.name.split('-');

            var tag = status(o.departs_at,'departure');
            $schedule_set.append('<li>' +
                '<div class="a"><span class="ui-li-count">' + (new Date(o.departs_at)).toTwelveHourTimeString() + '</span></div>' +
                '<div class="b"><span class="status '+ tag +'">' + tag +'</span></div>' +
                '<div class="c">' + terminals[0] + '</div></li>'
            );

            $.each(o.stops, function (a, b) {
                tag = status(b.departs_at);
                $schedule_set
                    .append('<li>' +
                    '<div class="a"><span class="ui-li-count">' + (new Date(b.arrives_at)).toTwelveHourTimeString() + '</span></div>' +
                    '<div class="b"><span class="status '+ tag +'">' + tag +'</span></div>' +
                    '<div class="c">' + b.name + '</div></li>'
                );
            });

            tag = status(o.arrives_at,'arrival');
            $schedule_set.append('<li>' +
                '<div class="a"><span class="ui-li-count">' + (new Date(o.arrives_at)).toTwelveHourTimeString() + '</span></div>' +
                '<div class="b"><span class="status '+ tag +'">' + tag +'</span></div>' +
                '<div class="c">' + terminals[1] + '</div></li>'
            );

        })(schedule);
        $('div#live-progress section').html($schedule_set);
        $('div#live-progress').trigger('create');
    });

    $('ul#all-routes-progress li:first-child a').click();
});

$(document).on('pageshow', 'div#settings', function () {
    $.each(['name', 'email', 'number', 'app_key'], function (i, o) {
        $('input[name="user[' + o + ']"]').val(app.account[o]);
    });
    $('input#set-default-number').change(function () {
        if (this.checked) {
            app.payment = { mobileMoneyNumber:$('input[name="user[number]"]').val() };
        }
    });
});

$(document).on('pageshow', 'div#feedback', function () {
    $('div#feedback section').empty();
    var $ul = $('<ul data-role="listview">');
    $.each(app.feedback, function (i, o) {
        var date = new Date(o.created_at);
        $ul.append('<li>' + o.message + '<span class="ui-li-count">' + date.toTwelveHourTimeString() + '</span> ' +
            '<p class="ui-li-aside">' + date.toLocaleDateString() + ' </p>' +
            '</li>');
    });
    $('div#feedback section').html($ul);
    $('div#feedback').trigger('create');
});
