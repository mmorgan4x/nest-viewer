// @ts-check
 /** @type {import("jsZip")} */ var JSZip;
 /** @type {import("highcharts")} */ var Highcharts;
 /** @type {import("moment")} */ var moment;
 /** @type {import("bootstrap")} */ var booststrap;

let data = [];

async function uploadFile(file) {
    $('#loading').removeClass('hide');

    try {
        //parse data from file
        data = await parseZip(file);
        //filter out missing points
        data = data.filter(t => !!t.Date && !!t.Time && !!t['avg(temp)'] && !!t['avg(humidity)']);
        //map to chart data
        data = data.map(t => ({
            date: new Date(`${t.Date} ${t.Time}:00`).getTime(),
            temp: +t['avg(temp)'],
            humidity: +t['avg(humidity)']
        }));
        //sort by datetime
        data.sort((a, b) => a.date - b.date);

        $('#file-name').text(file.name);
        update();
    }
    catch {
        (new bootstrap.Toast($('.toast')[0])).show();
        $('#loading').addClass('hide');
        $('#file-input').val('');
    }
}

async function parseZip(file) {
    let jsZip = new JSZip();
    let zip = await jsZip.loadAsync(file);
    let files = Object.values(zip.files);
    let csvs = files.filter(t => t.name.endsWith('.csv'));

    let d = [];
    for (let csv of csvs) {
        let csvStr = await csv.async('text');
        let rows = parseCSV(csvStr);
        d = d.concat(rows);
    }
    return d;
}

function parseCSV(csvStr) {
    let rows = [];
    let arr = csvStr.split('\n');
    let headers = arr[0].split(',');
    for (let i = 1; i < arr.length; i++) {
        let d = arr[i].split(',');
        let obj = {};
        for (let j = 0; j < d.length; j++) {
            obj[headers[j].trim()] = d[j].trim();
        }
        rows.push(obj);
    }
    return rows;
}

function update() {
    $('#landing').addClass('hide');
    $('#chart').removeClass('hide');
    $('.navbar-nav').removeClass('hide');
    $('.help-btn').addClass('hide');
    $('#no-data').addClass('hide');

    //units
    let isCelcius = $('#degree').val() == 'C';
    let filteredData = data.map(t => ({ date: t.date, temp: isCelcius ? t.temp : (t.temp * 9 / 5) + 32, humidity: t.humidity }));

    //date range
    let maxDate = moment(data[data.length - 1].date);
    let minDate = moment(data[0].date);

    let filterEnd = $('#endDate').val() ? moment($('#endDate').val()) : null;
    let filterStart = $('#startDate').val() ? moment($('#startDate').val()) : null
    if (!filterEnd) { filterEnd = maxDate }
    if (!filterStart) { filterStart = minDate }

    $('#endDate').val(filterEnd.format('YYYY-MM-DD'));
    $('#startDate').val(filterStart.format('YYYY-MM-DD'));

    filteredData = filteredData.filter(t => t.date > filterStart.valueOf() && t.date < filterEnd.valueOf());

    //data chunking
    let [, increment, unit] = $('#increment').val().toString().match(/(\d+)(.+)/);
    let grouped = groupBy(filteredData, t => roundDate(moment(t.date), +increment, unit).valueOf());
    
    filteredData = grouped.map(t => ({
        date: t.key,
        temp: t.value.reduce((a, b) => a + b.temp, 0) / t.value.length,
        humidity: t.value.reduce((a, b) => a + b.humidity, 0) / t.value.length,
    }));

    //draw chart
    if (filteredData.length) {
        drawChart(filteredData, () => $('#loading').addClass('hide'));
    }
    else {
        $('#chart').addClass('hide');
        $('#loading').addClass('hide');
        $('#no-data').removeClass('hide');
    }
}

function groupBy(list, keyGetter) {
    const map = new Map();
    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return Array.from(map, ([key, value]) => ({ key, value }));
}

function roundDate(date, increment, unit) {
    let nextMap = { 'm': 'h', 'h': 'd', 'd': 'w' }
    return date.clone().startOf(nextMap[unit]).add(Math.floor(date.get(unit) / increment) * increment, unit);
}

function drawChart(filteredData, cb) {

    //add plot line for each month and day
    let monthPlotlines = [];
    let dayPlotlines = [];
    if (filteredData.length) {
        let end = moment(filteredData[filteredData.length - 1].date).valueOf();
        for (let i = moment(filteredData[0].date); i.valueOf() < end; i.add(1, 'M')) {
            monthPlotlines.push(i.startOf('M').valueOf())
        }
        for (let i = moment(filteredData[0].date); i.valueOf() < end; i.add(1, 'd')) {
            dayPlotlines.push(i.startOf('d').valueOf())
        }
    }

    //init chart
    let chart = Highcharts.chart('chart', {
        chart: {
            animation: false,
            type: 'line',
            panning: true,
            events: { load: cb }
        },
        title: false,
        subtitle: false,
        colors: ['#db3236', '#f4c20d', '#4885ed ', , '#3cba54 '],
        xAxis: {
            type: 'datetime',
            plotLines: []
                .concat(dayPlotlines.map(t => ({ value: t, color: '#eee', width: 1 })))
                .concat(monthPlotlines.map(t => ({ value: t, color: '#ccc', width: 2 }))),
            dateTimeLabelFormats: {
                minute: '%l:%M %P',
                hour: '%l %P',
                day: '%b %e',
                week: '%b %e',
                month: '%b \'%y',
                year: '%Y'
            }
        },
        yAxis: {
            min: 0,
            title: false
        },
        tooltip: {
            xDateFormat: '%b %e, %Y - %l:%M %p',
            shared: true,
            crosshairs: true,
            valueDecimals: 2
        },
        time: { useUTC: false },

        series: [
            {
                name: 'Temperature',
                data: filteredData.map(t => ([t.date, t.temp])),
                tooltip: { valueSuffix: `&deg${$('#degree').val()}` },
            },
            {
                name: 'Humidity',
                data: filteredData.map(t => ([t.date, t.humidity])),
                tooltip: { valueSuffix: '%' },
            }
        ]
    });

    //zoom controls
    $('#chart svg').on('mousewheel', function (e) {
        let mouseX = chart.pointer.normalize(e.originalEvent);

        let delta = e.originalEvent.wheelDelta;
        let zoomFactor = (delta > 0 ? -1 : 1) * .2;
        let valX = chart.xAxis[0].toValue(mouseX.chartX);

        var extremes = chart.xAxis[0].getExtremes();
        var range = extremes.max - extremes.min;
        var min = Math.max(extremes.dataMin, extremes.min - (range * zoomFactor) * ((valX - extremes.min) / range));
        var max = Math.min(extremes.dataMax, extremes.max + (range * zoomFactor) * ((extremes.max - valX) / range));

        chart.xAxis[0].setExtremes(min, max);
        chart.showResetZoom();
    });
}

function reset() {
    $('#landing').removeClass('hide');
    $('#chart').addClass('hide');
    $('.navbar-nav').addClass('hide');
    $('.help-btn').removeClass('hide');
    $('#no-data').addClass('hide');
    $('#file-input').val('');
    $('#endDate').val(moment().format('YYYY-MM-DD'));
    $('#startDate').val(moment().subtract(2, 'M').format('YYYY-MM-DD'))
}

(function init() {

    //file drag and drop
    var dragCounter = 0;
    $('body').on('dragover drop', function (e) {
        e.preventDefault();
    })
    $('body').on('dragenter', function () {
        dragCounter++;
        $('.drop-area').addClass('active');
    })
    $('body').on('dragleave', function (e) {
        dragCounter--;
        if (dragCounter === 0) { $('.drop-area').removeClass('active'); }
    })
    $('body').on('drop', function (e) {
        dragCounter = 0
        $('.drop-area').removeClass('active');
        uploadFile(e.originalEvent.dataTransfer.files[0]);
    });

    // filter inputs
    $('#endDate').val(moment().format('YYYY-MM-DD'));
    $('#startDate').val(moment().subtract(2, 'M').format('YYYY-MM-DD'))
    $('input[type="date"]').on('mousedown', function (e) { e.preventDefault(); });
    $('input[type="date"],select').on('change', function () { update() });

    //file input upload
    $('#file-input').on('change', function (e) { uploadFile(this.files[0]) });
    //reset file
    $('.remove-btn').on('click', function () { reset() });

})();

