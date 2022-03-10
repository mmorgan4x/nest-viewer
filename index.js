// import JSZip from 'jsZip';

document.getElementById('file-input').onchange = async function () {
    let data = await parseZip(this.files[0]);

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
};

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
            panKey: 'shift'
        },
        xAxis: {
            type: 'datetime',
            plotLines: plotlines.map(t => ({ value: t }))
        },
        yAxis: {
            min: 0,
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