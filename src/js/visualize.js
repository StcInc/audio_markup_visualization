var TRACK_HEIGHT = 1;

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



// Diarization markup visualization

function prepareDiarizationGraphShapes(markup, speakers) {
    // speakers - sets speaker ordering
    var graphShapes = [];
    for (var i = 0; i < speakers.length; ++i) {
        var color = colors[i];
        var intervals = markup[speakers[i]];
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
    return graphShapes;
}

function getTickerLine(t, minY, maxY) {
    return {
        type: 'line',
        x0: t,
        y0: minY,
        x1: t,
        y1: maxY,
        line: {
            color: '#d62728',
            width: 3
        }
    }
}

function DiarizationMarkupDisplay(root, title,  height, duration, markup) {
    var graphData = []; // not used for diarization

    var graphShapes = prepareDiarizationGraphShapes(markup, Object.keys(markup));

    var numSpeakers = Object.keys(markup).length;
    var graphLayout = {
        title: title || 'Markup',
        xaxis: {
            range: [0, duration],
        },
        yaxis: {
            range: [0, numSpeakers * TRACK_HEIGHT],
            showgrid: false,
            ticks: null,
            showline: false,
            showticklabels: false,  // TODO: show speaker ids
            fixedrange: true
        },
        height: height,
        shapes: graphShapes
    };

    var graphConfig = {
        responsive: true,
        scrollZoom: true,
        click: true
    };
    var relayoutCallback = function (data) { };

    graphShapes.push(
        getTickerLine(
            0,
            graphLayout.yaxis.range[0],
            graphLayout.yaxis.range[1]
        )
    );

    Plotly.newPlot(
        root,
        graphData,
        graphLayout,
        graphConfig
    );

    function updatePlot(){
        Plotly.redraw(root);
    }

    function updateTicker(currentTime) {
        graphShapes[graphShapes.length-1].x0 = currentTime;
        graphShapes[graphShapes.length-1].x1 = currentTime;

        updatePlot();
    }

    // zoom/relayout
    var relayoutCallbackActive = false;
    function _relayout (data) {
        var keys = Object.keys(data);
        if (relayoutCallbackActive && (keys.includes('xaxis.range[0]') || keys.includes('xaxis.range[1]'))) {
            relayoutCallback(data);
        }
        // hack: to prevent endless loop - for some reason immidiate callback re activation causes infinite callback loop
        setTimeout(function (){
            relayoutCallbackActive = true;
        }, 300);
    }

    function setOnRelayoutCallback(callback) {
        relayoutCallback = callback;
        document.getElementById(root).on("plotly_relayout", _relayout);
        relayoutCallbackActive = true;
    }

    function relayout(data) {
        relayoutCallbackActive = false;

        Plotly.relayout(root, data);
    }

    // TODO: position seek - doesn't work for some reason
    // document.getElementById(root).on("plotly_click", function (data) {
    //     console.log("Clicked", data);
    // })


    return {
        updateTicker: updateTicker,
        onRelayout: setOnRelayoutCallback,
        relayout: relayout
    }
}


function MarkupVisualizer(root) {
    // For now it doesn't support dynamic data loading (streaming)

    // state
    var markupAdded = false;
    var audioDurationAdded = false;
    var onReadyCallback = function() { };

    var audioDuration = 0;
    var markup = {};  // { markup_title_1: markup_1, ...}
    var curPos = 0;


    var displays = [];

    // api
    function isReady() {
        return markupAdded && audioDurationAdded;
    }

    var relayoutsLeft = 10;
    function relayout(data) {
        if (relayoutsLeft) {
            for (var i = 0; i < displays.length; ++i) {
                displays[i].relayout(data);
            }
        }
        relayoutsLeft -= 1;
    }

    function visualize() {
        if (isReady) {
            if (! displays.length) {
                var height = window.innerHeight - document.getElementById('controlls').clientHeight;
                height /= Object.keys(markup).length;

                for (var markupTitle in markup) {
                    $("#" + root).append('<div id="' + markupTitle + '"></div>')
                    var display = new DiarizationMarkupDisplay(
                        markupTitle, // root element
                        markupTitle, // title
                        height,  // TODO: calculate height dynamically
                        audioDuration,
                        markup[markupTitle]
                    );
                    displays.push(display);
                }
                for (var i = 0; i < displays.length; ++i) {
                    displays[i].onRelayout(relayout);
                    // var d = displays[i];
                    // d.onRelayout(function (data) {
                    //     relayout(data, d);
                    // });
                }
            }
        }
    }

    function addMarkup(m) {
        markup = m;
        markupAdded = true;
        if (isReady()) {
            onReadyCallback();
        }
    }

    function addDuration(duration) {
        audioDuration = duration;
        audioDurationAdded = true;
        if (isReady()) {
            onReadyCallback();
        }
    }

    function updateTicker(pos) {
        curPos = pos;
        for (var i = 0; i < displays.length; ++i) {
            displays[i].updateTicker(pos);
        }
    }

    function setOnReadyCallback(callback) {
        onReadyCallback = callback;
        if (isReady()) {
            onReadyCallback();
        }
    }

    return {
        addMarkup: addMarkup,
        addDuration: addDuration,

        visualize: visualize,

        onReady: setOnReadyCallback,
        ready: isReady,
        updateTicker: updateTicker,
    };
}

window.onload = function() {
    console.log("Loading...");
    $("#status").text("Loading...");
    $('#play').prop( "disabled", true );
    $('#reset').prop( "disabled", true );

    var markupVis = MarkupVisualizer('graph');

    // 1. setup audio
    var audioFile = $("#file").val();
    audioObj = new Audio("/audio?file=" + audioFile);
    audioObj.loop = false;

    // 2. get audio duration
    audioObj.addEventListener("loadedmetadata", function(){
        console.log("Meta loaded")
        $("#cur").text(0.0 + " / " + audioObj.duration + " s");
        markupVis.addDuration(audioObj.duration);
    });

    // 3. markup setup
    $.get("/markup?file=" + audioFile, function(markup) {
        console.log("Markup loaded", markup);
        markupVis.addMarkup(markup);
    });

    // 4. setup visualization
    markupVis.onReady(function () {
        console.log("Markup visualization ready");
        markupVis.visualize();
    });

    // 5. enable play button
    audioObj.addEventListener("canplaythrough", function () {
        $("#status").text("Ready.");
        $('#play').prop( "disabled", false );
        $('#reset').prop( "disabled", false );
    });

    // 6. handle events
    var playing = false;
    function play() {
        playing = true;
        $("#play").text("Pause");
        $("#cur").text(audioObj.currentTime + " / " + audioObj.duration + " s");
        audioObj.play();
    }

    function pause() {
        playing = false;
        $("#play").text("Play");
        audioObj.pause();
    }

    $('#play').click(function(){
        if (playing) {
            pause();
        }
        else {
            play();
        }
    });

    $('#reset').click(function() {
        playing = false;
        audioObj.pause();
        audioObj.currentTime = 0;
        $("#cur").text(0.0 + " / " + audioObj.duration + " s");
        markupVis.updateTicker(audioObj.currentTime);
    });

    audioObj.addEventListener("timeupdate", function() {
        $("#cur").text(audioObj.currentTime + " / " + audioObj.duration + " s");
        markupVis.updateTicker(audioObj.currentTime);
    });

    audioObj.addEventListener("ended", function() {
        $("#status").text("Ended.");
        $("#play").text("Play");
        audioObj.pause();
        audioObj.currentTime = 0;
    });

};
