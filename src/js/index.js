var TRACK_HEIGHT = 2;

var colors = [
    '#1f77b4',  // muted blue
    '#ff7f0e',  // safety orange
    '#2ca02c',  // cooked asparagus green
                                                  //'#d62728',  // brick red
    '#9467bd',  // muted purple
    '#8c564b',  // chestnut brown
                                                //'#e377c2',  // raspberry yogurt pink
    '#7f7f7f',  // middle gray
    '#bcbd22',  // curry yellow-green
    '#17becf'   // blue-teal
];

var graphData = []; // not used

var graphShapes = [
];


var graphLayout = {
    title: 'Markup',
    xaxis: {
        range: [0, 4],

    },
    yaxis: {
        range: [0, TRACK_HEIGHT],
        showgrid: false,
        ticks: null,
        showline: false,
        showticklabels: false
    },
    shapes: graphShapes
};



function drawPlot(){
    Plotly.newPlot(
        'graph',
        graphData,
        graphLayout
    );
}

function updatePlot(){
    Plotly.redraw("graph");
}

function setTimeLimits(limits) {
    graphLayout.xaxis.range[0] = limits.start;
    graphLayout.xaxis.range[1] = limits.stop;
    updatePlot();
}




function updateTicker(currentTime, duration) {
    var w = (currentTime) / duration * 100 +'%'
    $("#cur").text(currentTime + " / " + duration + " s");
    $('.hp_range').stop(true, true).animate({'width': w}, 250,'linear');

    var tickerLine = {
        type: 'line',
        x0: currentTime,
        y0: graphLayout.yaxis.range[0],
        x1: currentTime,
        y1: graphLayout.yaxis.range[1],
        line: {
            color: '#d62728',
            width: 3
        }
    };

    if (graphShapes.length == 0) {
        setTimeLimits({start: 0, stop: duration});
        graphShapes.push(tickerLine);
    }
    else {
        if (graphShapes[graphShapes.length - 1].type === 'line') {
            graphShapes[graphShapes.length - 1] = tickerLine;
        } else {
            graphShapes.push(tickerLine);
        }
    }
    updatePlot();
}


function renderMarkup(markup) {
    graphShapes.splice(0, graphShapes.length);  // remove old markup

    var tracks = Object.keys(markup);
    graphLayout.yaxis.range[0] = 0;
    graphLayout.yaxis.range[1] = tracks.length * TRACK_HEIGHT;

    for (var i = 0; i < tracks.length; ++i) {
        var color = colors[i];
        var intervals = markup[tracks[i]];
        for (var j = 0; j < intervals.length; ++j) {
            graphShapes.push({
                type: 'rect',
                xref: 'x',
                yref: 'y',
                x0: intervals[j]["start"] / 1000,
                y0: i * TRACK_HEIGHT,
                x1: intervals[j]["stop"] / 1000,
                y1: (i + 1) * TRACK_HEIGHT,
                line: {
                    color: color,
                    width: 3
                },
                fillcolor: color
            });
        }
    }

    updatePlot();
}


window.onload = function() {


    $('#play').click(function(){
        $("#status").text("Loading...");
        var audioObj = new Audio("/audio");
        audioObj.loop = false;

        drawPlot();

        $.get("/markup", function(markup) {
            renderMarkup(markup);
        });


        function canPlayThrough() {
            audioObj.removeEventListener("canplaythrough", canPlayThrough);

            $("#cur").text(0.0 + " / " + audioObj.duration + " s");

            setTimeLimits({start: 0, stop: audioObj.duration});

            $("#status").text("Playing...");
            audioObj.play();
            $("#play").text("Pause");

            audioObj.addEventListener("timeupdate", function() {
                updateTicker(audioObj.currentTime, audioObj.duration);
            });

            $("#play").unbind("click");
            $("#play").click(function() {
                if ($("#play").text() === "Play") {
                    if (audioObj.ended) {
                        audioObj.currentTime = 0;
                    }
                    audioObj.play();
                    $("#play").text("Pause");
                    $("#status").text("Playing...");
                } else {
                    audioObj.pause();
                    $("#play").text("Play");
                    $("#status").text("Paused...");
                }
            });

            audioObj.addEventListener("ended", function() {
                $("#status").text("Ended.");
                $("#play").text("Play");
                audioObj.pause();

            });
        }

        audioObj.addEventListener("canplaythrough", canPlayThrough);
    });


};