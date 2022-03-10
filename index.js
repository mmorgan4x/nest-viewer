//// @ts-check
 /** @type {import("jsZip")} */ var JSZip;
 /** @type {import("highcharts")} */ var Highcharts;
 /** @type {import("jquery")} */ var $;

async function uploadFile(file) {
    $('#loading').removeClass('hide');

    let data = await parseZip(file);

    data = data.filter(t => !!t.Date && !!t.Time && !!t['avg(temp)'] && !!t['avg(humidity)']);
    console.log(data)
    data = data.map(t => ({
        date: new Date(`${t.Date} ${t.Time}:00`).getTime(),
        temp: toF(+t['avg(temp)']),
        humidity: +t['avg(humidity)']
    }));
    data.sort((a, b) => a.date - b.date);
    data = data.slice(0, 10000)

    drawChart(data);
}

async function parseZip(file) {
    let jsZip = new JSZip();
    let zip = await jsZip.loadAsync(file);
    let files = Object.values(zip.files);
    let csvs = files.filter(t => t.name.endsWith('.csv'));

    let data = [];
    for (let csv of csvs) {
        let csvStr = await csv.async('text');
        let rows = parseCSV(csvStr);
        data = data.concat(rows);
    }
    return data;
}

function parseCSV(csvStr) {
    let rows = [];
    let arr = csvStr.split('\n');
    let headers = arr[0].split(',');
    for (var i = 1; i < arr.length; i++) {
        let data = arr[i].split(',');
        let obj = {};
        for (let j = 0; j < data.length; j++) {
            obj[headers[j].trim()] = data[j].trim();
        }
        rows.push(obj);
    }
    return rows;
}

function toF(celcius) {
    return (celcius * 9 / 5) + 32;
}

function drawChart(data) {

    $('#landing').addClass('hide');
    $('#chart').removeClass('hide');

    let plotlines = [];
    let start = new Date(data[0].date)
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0);
    let end = new Date(data[data.length - 1].date);
    for (let i = start.getTime(); i < end.getTime(); i += 86400000) {
        plotlines.push(i)
    }

    Highcharts.chart('chart', {
        chart: {
            animation: false,
            zoomType: 'x',
            type: 'line',
            panning: true,
            panKey: 'shift',
            events: {
                load: e => $('#loading').addClass('hide')
            }
        },
        title: false,
        subtitle: false,
        colors: ['#db3236', '#f4c20d', '#4885ed ', , '#3cba54 '],
        xAxis: {
            type: 'datetime',
            plotLines: plotlines.map(t => ({ value: t }))
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
            data: data.map(t => ([t.date, t.temp])),
            tooltip: { valueSuffix: '&degF' },
        },
        {
            name: 'Humidity',
            data: data.map(t => ([t.date, t.humidity])),
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
}

init();
