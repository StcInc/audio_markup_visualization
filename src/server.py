import os
import re
import sys
import json
import time

import codecs
import argparse

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

def read_config(path=config_path):
    with codecs.open(path, 'r', 'utf-8') as f:
        return json.load(f)
config = read_config()

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
    return response.html(render_template(
        "index.html"
    ))


@app.route("/catalog")
async def catalog(request):
    return response.json({"files": os.listdir(cofnig["save_folder"])})


@app.route("/audio")
async def audio(request):
    # TODO: check if path provided and allowed, return file located at path
    return await response.file('/media/monster/_Work/diarization/dir_vis/src/saved/tmp.wav')


@app.route("/markup")
async def markup(request):
    dummy_markup = {
        "0": [
            {"start": 0, "stop": 1330},
            {"start": 1560, "stop": 2133}
        ],
        "1": [
            {"start": 1120, "stop": 1567},
            {"start": 2134, "stop": 2500}
        ]
    }
    return response.json(dummy_markup)



if __name__ == "__main__":
    app.run(
        host=config["host"],
        port=config["port"],
        debug=config["debug"],
        workers=config["workers"]
    )
