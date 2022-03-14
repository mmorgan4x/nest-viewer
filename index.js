// @ts-check
 /** @type {import("jsZip")} */ var JSZip;
 /** @type {import("highcharts")} */ var Highcharts;
 /** @type {import("moment")} */ var moment;

let data = [];

async function uploadFile(file) {
    $('#loading').removeClass('hide');

    data = await parseZip(file);
    data = data.filter(t => !!t.Date && !!t.Time && !!t['avg(temp)'] && !!t['avg(humidity)']);
    data = data.map(t => ({
        date: new Date(`${t.Date} ${t.Time}:00`).getTime(),
        temp: +t['avg(temp)'],
        humidity: +t['avg(humidity)']
    }));
    data.sort((a, b) => a.date - b.date);

    update();
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
    for (var i = 1; i < arr.length; i++) {
        let d = arr[i].split(',');
        let obj = {};
        for (let j = 0; j < d.length; j++) {
            obj[headers[j].trim()] = d[j].trim();
        }
        rows.push(obj);
    }
    return rows;
}

function toF(celcius) {
    return;
}

function update() {
    $('#landing').addClass('hide');
    $('#chart').removeClass('hide');
    $('.navbar-nav').removeClass('hide');

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
    let increment = +$('#increment').val();
    let chunkData = [];
    for (let i = 0; i < filteredData.length; i += increment) {
        let chunk = filteredData.slice(i, i + increment);
        chunkData.push({
            date: chunk[0].date,
            temp: chunk.reduce((a, b) => a + b.temp, 0) / chunk.length,
            humidity: chunk.reduce((a, b) => a + b.humidity, 0) / chunk.length
        });
    }
    filteredData = chunkData;

    drawChart(filteredData, () => $('#loading').addClass('hide'));
}

function drawChart(filteredData, cb) {

    let plotlines = [];
    if (filteredData.length) {
        let start = new Date(filteredData[0].date)
        start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
        let end = new Date(filteredData[filteredData.length - 1].date);
        for (let i = start.getTime(); i < end.getTime(); i += 86400000) {
            plotlines.push(i)
        }
    }

    Highcharts.chart('chart', {
        chart: {
            animation: false,
            zoomType: 'x',
            type: 'line',
            panning: true,
            panKey: 'shift',
            events: { load: cb }
        },
        title: false,
        subtitle: false,
        colors: ['#db3236', '#f4c20d', '#4885ed ', , '#3cba54 '],
        xAxis: {
            type: 'datetime',
            plotLines: plotlines.map(t => ({ value: t, color: '#eee' }))
        },
        yAxis: {
            min: 0,
            title: false
        },
        tooltip: {
            xDateFormat: '%Y-%m-%d %H:%M',
            shared: true,
            crosshairs: true,
            valueDecimals: 2
        },

        series: [{
            name: 'Temperature',
            data: filteredData.map(t => ([t.date, t.temp])),
            tooltip: { valueSuffix: `&deg${$('#degree').val()}` },
        },
        {
            name: 'Humidity',
            data: filteredData.map(t => ([t.date, t.humidity])),
            tooltip: { valueSuffix: '%' },
        }]
    });
}

function init() {

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
        let droppedFiles = e.originalEvent.dataTransfer.files;
        uploadFile(droppedFiles[0]);
    });

    //file input upload
    $('#file-input').on('change', function (e) {
        uploadFile(this.files[0]);
    });

    // filter inputs
    $('#endDate').val(moment().format('YYYY-MM-DD'));
    $('#startDate').val(moment().subtract(1, 'M').format('YYYY-MM-DD'))
    $('input[type="date"]').on('mousedown', function (e) { e.preventDefault(); });
    $('input[type="date"]').on('change', function () { update() });
    $('select').on('change', function () { update() });

}

init();
