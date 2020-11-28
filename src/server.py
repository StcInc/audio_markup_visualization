import os
import re
import sys
import json
import time

from datetime import datetime
from glob import glob

import uuid
import codecs
import argparse
import librosa

import aiofiles
import pysubs2

from sanic import Sanic
import sanic.response as response

src_root = os.path.dirname(os.path.abspath(__file__))

app = Sanic("Diarization visualization")

app.static('/css', os.path.join(src_root, 'css'))
app.static('/js', os.path.join(src_root, 'js'))


parser = argparse.ArgumentParser("Experiment control service")
parser.add_argument('--config', default="config.json", help='Path to service configuration file')
args = parser.parse_args()

config_path = args.config

def read_json(path):
    with codecs.open(path, 'r', 'utf-8') as f:
        return json.load(f)

config = read_json(path=config_path)

os.makedirs(config["save_folder"], exist_ok=True)



def ass_to_json(ass_path):
    res = {} # { speaker: [{start: start_ms, stop: stop_ms, text: 'phrase_text' } ]
    subs = pysubs2.load(ass_path)
    for i, line in enumerate(subs):
        if line.type == 'Dialogue':
            speaker_name = line.name
            res[speaker_name] = res.get(speaker_name, [])
            res[speaker_name].append({
                'start': int(line.start), # in ms
                'stop': int(line.end),
                'text': line.text
            })

    return res


# templating

def load_template(template):
    with codecs.open(os.path.join(src_root, "templates", template), 'r', 'utf-8') as f:
        template = f.read()
        return template


def _render_template(template, **kwargs):
    # print(kwargs)
    for k in kwargs:
        template = re.sub("{{\s*" + k + "\s*}}", kwargs[k], template)
    return template


# template_cache = {}
def render_template(template, **kwargs):
    # TODO: reenable template cache
    # global template_cache
    # if template not in template_cache:  # TODO: reenable template cache
    # template_cache[template] = load_template(template)
    # return _render_template(template_cache[template], **kwargs)
    return _render_template(load_template(template), **kwargs)


def render_table(header, data):
    thead = "".join(f"<th>{s}</th>" for s in header)
    thead = f"<thead><tr>{thead}</tr></thead>"

    tbody = "</tr><tr>".join("".join(f"<td>{c}</td>" for c in row)  for row in data)
    result = f'<div class="table-responsive"><table class="table table-striped"><thead><tr>{thead}</tr></thead><tbody><tr>{tbody}</tr></tbody></table></div>'

    return result


# app logic

def last(x):
    return x[-1]


def get_duration(path):
    try:
        return librosa.get_duration(filename=path)
    except Exception as e:
        return ""


def gather_markup(file, read_markup=True):  # file - basename without extension
    path = os.path.join(config["save_folder"], file)

    json_files = glob(f"{path}*.json")
    ass_files = glob(f"{path}*.ass")

    if read_markup:
        json_markup = {os.path.basename(f): read_json(f) for f in json_files}
        ass_markup = {os.path.basename(f): ass_to_json(f) for f in ass_files}

        markup = {k: m[k] for m in (json_markup, ass_markup) for k in m}
        return markup
    else:
        return json_files + ass_files

def ftime(timestamp):
    return datetime.fromtimestamp(timestamp).strftime("%d.%m.%Y %H:%M:%S")

@app.route("/")
async def index(request):
    files = []
    for file in os.listdir(config["save_folder"]):
        if file.endswith(".wav"):
            abs_path = os.path.join(config["save_folder"], file)
            paths = [abs_path] + gather_markup(file[:-4], False)
            duration = get_duration(abs_path)
            m_time = max(float(os.stat(f).st_mtime) for f in paths)
            files.append((
                f'<a href="/visualize?file={file[:-4]}">{file[:-4]}</a>',
                duration,
                "<br>".join(paths),
                ftime(m_time),
                m_time
            ))
    files = sorted(files, key=last, reverse=True)
    files = [f[:-1] for f in files]
    files = render_table(["id", "duration, s", "files", "last updated"], files)

    return response.html(render_template(
        "index.html",
        files=files
    ))


@app.route("/visualize")
async def visualize(request):
    file = request.args.get("file", None)
    if file:
        return response.html(render_template(
            "visualize.html",
            file=os.path.basename(file)
        ))
    return response.html(render_template(
        "error.html",
        error="No file provided, or invalid file"
    ))

@app.route("/audio")
async def audio(request):
    file = request.args.get("file", None)
    if file:
        files = glob(os.path.join(config["save_folder"], os.path.basename(file) + ".*"))
        if len(files):
            for f in files:
                ext = f.lower().split(".")[-1]
                if ext in {"wav", "wave", "mp3", "mp4", "3gp", "m4a", "m4b", "m4p", "m4r", "m4v", "ogg", "ogv", "ogx", "ogm", "spx", "opus", "webm", "flac"}:
                    return await response.file(f)
    return response.empty()


@app.route("/markup")
async def markup(request):
    file = request.args.get("file", None)
    if file:
        markup = gather_markup(os.path.basename(file))
        return response.json(markup)

    return response.json(
        {},
        status=400
    )


async def write_file(path, body):
    async with aiofiles.open(path, 'wb') as f:
        await f.write(body)
    f.close()

@app.route("/upload", methods=["GET", "POST"])
async def upload(request):
    audio_file = request.files.get('audio_file', None)
    file_name = str(uuid.uuid4())

    if audio_file:
        path = os.path.join(config["save_folder"], file_name + ".wav")
        await write_file(path, audio_file.body)

    else:
        return response.html(render_template(
            "error.html",
            error="No audio file provided for upload"
        ))

    markup_file = request.files.get('markup', None)
    if markup_file:
        path = os.path.join(config["save_folder"], file_name + ".json")
        await write_file(path, markup_file.body)

    ref_markup_file = request.files.get('ref_markup', None)
    if ref_markup_file:
        path = os.path.join(config["save_folder"], file_name + "_ref.json")
        await write_file(path, ref_markup_file.body)

    return response.redirect("/")


if __name__ == "__main__":
    app.run(
        host=config["host"],
        port=config["port"],
        debug=config["debug"],
        workers=config["workers"]
    )
