import os
import sys
import threading
import webbrowser
from flask import Flask, render_template, request, jsonify

# When running from pyinstaller, we need to locate templates/static differently
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'templates')
    static_folder = os.path.join(sys._MEIPASS, 'static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder)
else:
    app = Flask(__name__)

from . import api, logic
from .cli import categorize_sections
from .time_range import TimeRange, range_between_dates, range_last_days, range_since_date

def get_time_range_from_req(req_data):
    tr_type = req_data.get('time_range', 'all')
    if tr_type == 'last':
        days = int(req_data.get('days', 30))
        return range_last_days(days)
    elif tr_type == 'between':
        return range_between_dates(req_data.get('start_date'), req_data.get('end_date'))
    elif tr_type == 'since':
        return range_since_date(req_data.get('start_date'))
    return TimeRange()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/check-token', methods=['POST'])
def check_token():
    token = request.json.get('token')
    if not token:
        return jsonify({"error": "No token provided"}), 400
    
    # Try fetching sections to validate token
    sections = api.get_all_sections(token, use_cache=False)
    if sections == api.TokenExpired:
        return jsonify({"error": "Token expired or invalid"}), 401
    
    return jsonify({"status": "ok"})

@app.route('/api/sections', methods=['POST'])
def get_sections():
    token = request.json.get('token')
    sections = api.get_all_sections(token, use_cache=True)
    if sections == api.TokenExpired:
        return jsonify({"error": "Token expired"}), 401
    if not sections:
        return jsonify({"categories": []})
        
    categories = categorize_sections(sections)
    return jsonify({"categories": categories})

@app.route('/api/students', methods=['POST'])
def get_students():
    data = request.json
    token = data.get('token')
    method = data.get('method', 'shared')
    
    students = None
    if method == 'shared':
        shared = api.get_shared_collections(token)
        if shared == api.TokenExpired:
            return jsonify({"error": "Token expired"}), 401
        if shared is not None:
            students = logic.extract_students(shared)
    else:
        section_id = data.get('section_id')
        if not section_id:
            return jsonify({"error": "No section ID provided"}), 400
        students = api.get_students_from_section(token, section_id)
        if students == api.TokenExpired:
            return jsonify({"error": "Token expired"}), 401

    if students is None:
        return jsonify({"error": "Failed to fetch students"}), 500
        
    # Serialize sets to lists for JSON
    students_serializable = {}
    for name, s_data in students.items():
        s_data_copy = s_data.copy()
        s_data_copy['portfolio_ids'] = list(s_data['portfolio_ids'])
        students_serializable[name] = s_data_copy

    return jsonify({"students": students_serializable})

@app.route('/api/export', methods=['POST'])
def export_results():
    data = request.json
    token = data.get('token')
    students = data.get('students') # Expected format: { "Name": { "student_id": "...", "portfolio_ids": [...] } }
    include_reviewer = data.get('include_reviewer', False)
    
    try:
        time_range = get_time_range_from_req(data)
    except Exception as e:
        return jsonify({"error": f"Invalid time range: {str(e)}"}), 400

    all_results = []
    
    for name, s_data in students.items():
        # Convert list back to set for logic.collect_results
        s_data['portfolio_ids'] = set(s_data['portfolio_ids'])
        res = logic.collect_results(token, name, s_data, include_reviewer, time_range)
        if res == api.TokenExpired:
            return jsonify({"error": "Token expired during fetch"}), 401
        if res:
            all_results.extend(res)

    return jsonify({"results": all_results})

def start_server(port=8080):
    url = f"http://127.0.0.1:{port}"
    print(f"Starting web interface at {url}")
    threading.Timer(1.25, lambda: webbrowser.open(url)).start()
    
    # Disable flask logging for cleaner output
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)
    
    app.run(port=port, debug=False, use_reloader=False)

if __name__ == '__main__':
    start_server()
