function shittyDragndrop () {
    // https://habr.com/ru/post/125424/

    // <form action="/upload">
    //     <div id="dropZone">
    //         Для загрузки, перетащите аудио файл сюда.
    //     </div>
    // </form>
    //
    // <style>
    //     body {
    //         font: 12px Arial, sans-serif;
    //     }
    //
    //     #dropZone {
    //         color: #555;
    //         font-size: 18px;
    //         text-align: center;
    //
    //         width: 400px;
    //         padding: 50px 0;
    //         margin: 50px auto;
    //
    //         background: #eee;
    //         border: 1px solid #ccc;
    //
    //         -webkit-border-radius: 5px;
    //         -moz-border-radius: 5px;
    //         border-radius: 5px;
    //     }
    //
    //     #dropZone.hover {
    //         background: #ddd;
    //         border-color: #aaa;
    //     }
    //
    //     #dropZone.error {
    //         background: #faa;
    //         border-color: #f00;
    //     }
    //
    //     #dropZone.drop {
    //         background: #afa;
    //         border-color: #0f0;
    //     }
    // </style>


    var dropZone = $('#dropZone'),
        maxFileSize = 1000000000; // 1 GB

    if (typeof(window.FileReader) == 'undefined') {
        dropZone.text('Не поддерживается браузером!');
        dropZone.addClass('error');
    }

    dropZone[0].ondragover = function() {
        dropZone.addClass('hover');
        return false;
    };

    dropZone[0].ondragleave = function() {
        dropZone.removeClass('hover');
        return false;
    };

    dropZone[0].ondrop = function(event) {
        event.preventDefault();
        dropZone.removeClass('hover');
        dropZone.addClass('drop');

        var file = event.dataTransfer.files[0];

        if (file.size > maxFileSize) {
            dropZone.text('Файл слишком большой!');
            dropZone.addClass('error');
            return false;
        }

        var xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', uploadProgress, false);
        xhr.onreadystatechange = stateChange;
        xhr.open('POST', '/upload');
        xhr.setRequestHeader('X-FILE-NAME', file.name);
        xhr.send(file);

        function uploadProgress(event) {
            var percent = parseInt(event.loaded / event.total * 100);
            dropZone.text('Загрузка: ' + percent + '%');
        }

        function stateChange(event) {
            if (event.target.readyState == 4) {
                if (event.target.status == 200) {
                    dropZone.text('Загрузка успешно завершена!');
                } else {
                    dropZone.text('Произошла ошибка!');
                    dropZone.addClass('error');
                }
            }
        }
    };

};

window.onload = function () {

}
