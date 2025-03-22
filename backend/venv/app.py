from flask import Flask, request, jsonify
from flask_cors import CORS
import yaml
import os
import mysql.connector
from flask_bcrypt import Bcrypt
import jwt
from datetime import datetime, timedelta, timezone
import subprocess
import re
import logging

logging.basicConfig(filename="netcentral.log",level=logging.INFO,format="%(asctime)s - %(levelname)s - %(message)s") #Logging setup

config_path = '/home/vlc/bakalauro_Kodas/backend/config.yml'
def loadConfig():
    with open(config_path, 'r') as config_file:
        return yaml.safe_load(config_file)

config = loadConfig()

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)
app.config['SECRET_KEY'] = config['general']['secret_key']
token_expiration_hours = config['general']['token_expiration_hours']

# Connection to database
db = mysql.connector.connect(
    host=config['database']['host'],
    user=config['database']['user'],
    password=config['database']['password'],
    database=config['database']['database'],
    autocommit=True
)


def reconnect_db():
    global db
    try:
        db.close()
    except:
        pass
    try:
        db = mysql.connector.connect(
            host=config['database']['host'],
            user=config['database']['user'],
            password=config['database']['password'],
            database=config['database']['database'],
            autocommit=True
        )
        logging.info("✅ Database connection reestablished")
    except mysql.connector.Error as e:
        logging.error(f"❌ Failed to reconnect to database: {e}")

##====================================================================
#                       LOGIN
#====================================================================

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    
    if user and bcrypt.check_password_hash(user['password_hash'], password):
        token = jwt.encode(
            {
                'user_id': user['id'],
                'role': user['role'],
                'username': user['username'],
                'exp': datetime.now(timezone.utc) + timedelta(hours=1)
            },
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        logging.info(f"User {username} logged in successfully")
        return jsonify({'token': token}), 200

    logging.warning(f"Failed login attempt for user {username}")    
    return jsonify({"error": "Invalid Credentials"}), 401

##====================================================================
#                       USERS
#====================================================================

@app.route('/users', methods=['GET'])
def get_users():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role FROM users")
    users = cursor.fetchall()
    cursor.close()
    return jsonify(users), 200

@app.route('/users', methods=['POST'])
def add_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
        (username, password_hash, role)
    )
    db.commit()
    cursor.close()
    logging.info(f"User {username} added with role {role}")
    return jsonify({"message": "User Added"}), 201

@app.route('/users/<int:id>', methods=['PUT'])
def update_user(id):
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    cursor = db.cursor()
    if password:
        password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        cursor.execute(
            "UPDATE users SET username = %s, password_hash = %s, role = %s WHERE id = %s",
            (username, password_hash, role, id)
        )
    else:
        cursor.execute(
            "UPDATE users SET username = %s, role = %s WHERE id = %s",
            (username, role, id)
        )
    db.commit()
    cursor.close()
    logging.warning(f"Users {username} account details is changed")
    return jsonify({"message": "User updated"}), 200

@app.route('/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    cursor = db.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "User not found"}), 404
    cursor.close()
    logging.warning(f"User {username} is deleted")
    return jsonify({"message": "User deleted"}), 200

##====================================================================
#                       DEVICES
#====================================================================

@app.route('/devices', methods=['GET'])
def get_devices():
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify({"error": "Authorization token missing or invalid"}), 401

    token = auth_header.split(' ')[1]
    try:
        jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
    except jwt.ExpiredSignatureError as e:
        logging.error(f"Error: Token has expired: {e}")
        return jsonify({"Error": "Token has expired"}), 401
    except jwt.InvalidTokenError as e:
        logging.error(f"Error: Invalid Token Error: {e}")
        return jsonify({"Error": "Invalid token"}), 401

    # Connection with DB check
    if not db.is_connected():
        try:
            reconnect_db()
        except mysql.connector.Error as e:
            logging.error(f"Error: Database connection error: {e}")
            return jsonify({"Error": f"Database connection error: {e}"}), 500

    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT * FROM network_equipment")
        devices = cursor.fetchall()
        cursor.close()
        return jsonify(devices), 200
    except mysql.connector.Error as e:
        logging.error(f"Error: Database query error: {e}")
        return jsonify({"Error": f"Database query error: {e}"}), 500




def get_snmp_data(ip_address, oid, community='public'):
    try:
        result = subprocess.run(
            ['snmpget', '-v2c', '-c', community, ip_address, oid],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode == 0:
            output = result.stdout.strip().split("= ", 1)[1]
            return output.replace("STRING: ", "").replace('"', '').strip()
        else:
            print("Error:", result.stderr)
            return None
    except Exception as e:
        print(f"Exception occurred: {e}")
        return None

def get_device_info(ip_address, community='public'):
    device_info = {
        'ip_address': ip_address,
        'hostname': 'Unknown',
        'model': 'Unknown',
        'location': 'Unknown',
        'manufacturer': 'Unknown',
        'status': 'active'
    }

    model_oid = "1.3.6.1.2.1.1.1.0"
    hostname_oid = "1.3.6.1.2.1.1.5.0"
    location_oid = "1.3.6.1.2.1.1.6.0"
    
    # Getting system description - model, manufacturer and etc.
    full_description = get_snmp_data(ip_address, model_oid, community)
    if not full_description:
        return None  # If not returned any data gets none
    
    if "Cisco IOS Software" in full_description:
        match = re.search(r"(Cisco IOS Software.*?)(\d{4})", full_description, re.IGNORECASE)
        if match:
            device_info['model'] = f"Cisco {match.group(2)}"
            device_info['manufacturer'] = "Cisco"
    elif "RouterOS" in full_description:
        device_info['manufacturer'] = "MikroTik"
        if "RBD52G-5HacD2HnD" in full_description:
            device_info['model'] = "hAP ac²"
        else:
            device_info['model'] = full_description.split()[1]

    # Getting hostname
    device_info['hostname'] = get_snmp_data(ip_address, hostname_oid, community) or device_info['hostname']

    # Getting SNMP location
    device_info['location'] = get_snmp_data(ip_address, location_oid, community) or device_info['location']

    return device_info


@app.route('/devices/add', methods=['POST'])
def add_device():
    data = request.json
    ip_address = data.get('ip_address')
    community = data.get('community', 'public')
    
    if not ip_address:
        logging.error("Attempt to add device without IP address")
        return jsonify({"error": "IP address is required"}), 400

    token = request.headers.get('Authorization', '').split(' ')[1]
    try:
        decoded_token = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        username = decoded_token.get('username')
        print(f"Decoded username: {username}")
    except jwt.ExpiredSignatureError:
        logging.error("Error:" "Token has expired")
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        logging.error("Error:" "Invalid token")
        return jsonify({"Error": "Invalid token"}), 401

    # Getting data via SNMP
    device_info = get_device_info(ip_address, community)
    if not device_info:
        cursor=db.cursor()
        action_description=f"Error: User {username} - Failed to connect to device at {ip_address}. No response received."
        logging.warning(action_description)
        print(action_description)
        timestamp=datetime.now()
        cursor.execute("INSERT INTO recent_activity (message, timestamp) VALUES (%s, %s)", (action_description, timestamp))
        db.commit()
        cursor.close()
        logging.error("Error:" f"Failed to connect to device at {ip_address}. No response received.")
        return jsonify({"error": f"Failed to connect to device at {ip_address}. No response received."}), 500
        
        

    # Saving collected data in DB
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO network_equipment (ip_address, name, model, manufacturer, status, location) VALUES (%s, %s, %s, %s, %s, %s)",
        (device_info['ip_address'], device_info['hostname'], device_info['model'], device_info['manufacturer'], device_info['status'], device_info['location'])
    )
    db.commit()

    # Adding logs
    action_description = f"User {username} added a new device {device_info['hostname']} | IP: {device_info['ip_address']}"
    logging.info(action_description)
    print(action_description)
    timestamp = datetime.now()
    cursor.execute("INSERT INTO recent_activity (message, timestamp) VALUES (%s, %s)", (action_description, timestamp))
    db.commit()
    cursor.close()

    return jsonify(device_info), 201


@app.route('/devices/<int:device_id>', methods=['GET'])
def get_device_details(device_id):
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM network_equipment WHERE id = %s", (device_id,))
    device_info = cursor.fetchone()
    cursor.close()
    if device_info:
        return jsonify(device_info), 200
    else:
        return jsonify({"error": "Device not found"}), 404

##====================================================================
#                       Recent Activity
#====================================================================

@app.route('/recent-activity', methods=['GET'])
def get_recent_activity():
    try:
        # Checking connection with DB
        if not db.is_connected():
            db.reconnect()
        
        cursor = db.cursor(dictionary=True)
        cursor.execute("SELECT message, timestamp FROM recent_activity ORDER BY timestamp DESC LIMIT 5")
        recent_activity = cursor.fetchall()
        cursor.close()
        return jsonify(recent_activity), 200
    except mysql.connector.Error as e:
        logging.error("Error:" f" Database error: {e}")
        return jsonify({"error": f"Database error: {e}"}), 500
    except Exception as e:
        logging.error("Error:" f"Unexpected error: {e}")
        return jsonify({"error": f"Unexpected error: {e}"}), 500



##====================================================================
#                       Recent Activity
#====================================================================

@app.route('/alerts',methods=['GET'])
def get_alerts():
    return None


##====================================================================
#                       AUTHORIZATION HELPERS
#====================================================================

def get_user_role(token):
    try:
        decoded_token = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        return decoded_token.get('role', 'user')
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

##====================================================================
#                       ANSIBLE PLAYBOOKS
#====================================================================

ANSIBLE_PLAYBOOKS_DIR = '/home/vlc/bakalauro_Kodas/backend/ansible_playbooks/'

@app.route('/playbooks', methods=['GET'])
def list_playbooks():
    token = request.headers.get('Authorization', '').split(' ')[1]
    if not get_user_role(token):
        return jsonify({"error": "Unauthorized"}), 401
    try:
        playbooks = [f for f in os.listdir(ANSIBLE_PLAYBOOKS_DIR) if f.endswith('.yml')]
        return jsonify(playbooks), 200
    except Exception as e:
        logging.error(f"Error reading playbooks directory: {e}")
        return jsonify({"error": "Failed to read playbooks directory"}), 500

@app.route('/playbooks/<filename>', methods=['GET'])
def get_playbook(filename):
    token = request.headers.get('Authorization', '').split(' ')[1]
    if not get_user_role(token):
        return jsonify({"error": "Unauthorized"}), 401
    
    if not filename.endswith('.yml'):
        return jsonify({"error": "Invalid file type"}), 400
    try:
        with open(os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename), 'r') as file:
            content = file.read()
        return jsonify({"filename": filename, "content": content}), 200
    except FileNotFoundError:
        return jsonify({"error": "Playbook not found"}), 404
    except Exception as e:
        logging.error(f"Error reading playbook {filename}: {e}")
        return jsonify({"error": "Failed to read playbook"}), 500

@app.route('/playbooks/<filename>', methods=['POST'])
def create_playbook(filename):
    token = request.headers.get('Authorization', '').split(' ')[1]
    try:
        decoded_token = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        if decoded_token.get('role') != 'admin':
            return jsonify({"error": "Forbidden"}), 403
    except:
        return jsonify({"error": "Invalid token"}), 401
    
    if not filename.endswith('.yml'):
        return jsonify({"error": "Invalid file type"}), 400
    
    file_path = os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename)
    if os.path.exists(file_path):
        return jsonify({"error": "File already exists"}), 400
    
    try:
        with open(file_path, 'w') as file:
            file.write("# New Ansible Playbook\n")
        logging.info("New playbook is created")
        return jsonify({"message": "Playbook created"}), 201
    except Exception as e:
        logging.error("Error:" f"Failet to create playbook: {e}")
        return jsonify({"error": f"Failed to create playbook: {e}"}), 500        

@app.route('/playbooks/<filename>', methods=['PUT'])
def update_playbook(filename):
    token = request.headers.get('Authorization', '').split(' ')[1]
    if get_user_role(token) != 'admin':
        return jsonify({"error": "Forbidden"}), 403
    
    if not filename.endswith('.yml'):
        return jsonify({"error": "Invalid file type"}), 400
    data = request.json
    content = data.get('content')
    if not content:
        return jsonify({"error": "No content provided"}), 400
    try:
        with open(os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename), 'w') as file:
            file.write(content)
        logging.info(f"Playbook {filename} updated successfully")
        return jsonify({"message": "Playbook updated"}), 200
    except Exception as e:
        logging.error(f"Error updating playbook {filename}: {e}")
        return jsonify({"error": "Failed to update playbook"}), 500

@app.route('/playbooks/<filename>', methods=['DELETE'])
def delete_playbook(filename):
    token = request.headers.get('Authorization', '').split(' ')[1]
    if get_user_role(token) != 'admin':
        return jsonify({"error": "Forbidden"}), 403
    
    if not filename.endswith('.yml'):
        return jsonify({"error": "Invalid file type"}), 400
    try:
        os.remove(os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename))
        logging.info(f"Playbook {filename} deleted successfully")
        return jsonify({"message": "Playbook deleted"}), 200
    except FileNotFoundError:
        return jsonify({"error": "Playbook not found"}), 404
    except Exception as e:
        logging.error(f"Error deleting playbook {filename}: {e}")
        return jsonify({"error": "Failed to delete playbook"}), 500

@app.route('/playbooks/<filename>/execute', methods=['POST'])
def execute_playbook(filename):
    token = request.headers.get('Authorization', '').split(' ')[1]
    if not get_user_role(token):
        return jsonify({"error": "Unauthorized"}), 401
    
    if not filename.endswith('.yml'):
        return jsonify({"error": "Invalid file type"}), 400
    
    data=request.json
    logging.info(f"Raw data received in POST: {data}")
    device_ip = data.get('device_ip')

    ansibleUser=config['ansible']['username']
    ansiblePassword=config['ansible']['password']


    logging.info(f"Executing {filename} on device {device_ip}")

    env = {
    **os.environ,
    "ANSIBLE_CONFIG": "/home/vlc/bakalauro_Kodas/backend/ansible.cfg",
    "ANSIBLE_SSH_TYPE": "paramiko"
}

    try:
        result = subprocess.run(
            ["/home/vlc/bakalauro_Kodas/backend/venv/bin/ansible-playbook",
        os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename),
        "-i", f"{device_ip},",
        "-u", ansibleUser,
        "--extra-vars", f"ansible_password={ansiblePassword} ansible_network_os=cisco.ios.ios ansible_connection=network_cli target={device_ip}",
        "--ssh-common-args", "-o StrictHostKeyChecking=no"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        logging.info(f"Playbook {filename} executed successfully")
        return jsonify({"message": "Execution completed", "output": result.stdout}), 200
    except Exception as e:
        logging.error(f"Error executing playbook {filename}: {e}")
        return jsonify({"error": "Failed to execute playbook"}), 500

##====================================================================
#                       MAIN
#====================================================================

if __name__ == '__main__':
    logging.info("Starting NetCentral backend")
    app.run(host='0.0.0.0', port=5000, debug=True)
