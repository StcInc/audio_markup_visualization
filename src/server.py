import os
import re
import sys
import json
import time

import codecs
import argparse
import librosa

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

@app.route("/")
async def index(request):
    files = os.listdir(config["save_folder"])
    files = [
        (
            f'<a href="/visualize?file={file[:-4]}">{file[:-4]}</a>',
            librosa.get_duration(filename=os.path.join(config["save_folder"], file)),
            file,
            ((file[:-4] + ".json") if os.path.exists(os.path.join(config["save_folder"], file[:-4] + ".json")) else ""),
            ((file[:-4] + "_ref.json") if os.path.exists(os.path.join(config["save_folder"], file[:-4] + "_ref.json")) else "")
        )
        for file in files if file.endswith(".wav")
    ]
    files = render_table(["file", "duration, s", "audio", "markup", "reference markup(optional)"], files)

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
            file=file,
            reference_markup=((file + "_ref") if os.path.exists(os.path.join(config["save_folder"], file + "_ref.json")) else "")
        ))
    return response.html(render_template(
        "error.html",
        error="No file provided, or invalid file"
    ))

@app.route("/audio")
async def audio(request):
    # TODO: check if path provided and allowed, return file located at path
    file = request.args.get("file", None)
    print(file)
    if file:
        path = os.path.join(config["save_folder"], file + ".wav")
        if os.path.exists(path):
            return await response.file(path)
    return response.empty()


@app.route("/markup")
async def markup(request):
    file = request.args.get("file", None)
    if file:
        path = os.path.join(config["save_folder"], file + ".json")
        if os.path.exists(path):
            markup = read_json(path)
            return response.json(markup)
    return response.json(
        {},
        status=400
    )


if __name__ == "__main__":
    app.run(
        host=config["host"],
        port=config["port"],
        debug=config["debug"],
        workers=config["workers"]
    )
