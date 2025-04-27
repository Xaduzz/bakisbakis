from flask import Flask, request, jsonify
from flask_cors import CORS
import yaml
import os
import mysql.connector
from mysql.connector import pooling
from flask_bcrypt import Bcrypt
import jwt
from datetime import datetime, timedelta, timezone
import subprocess
import re
import logging
import threading
import time
import platform
import socket



logging.basicConfig(filename="netcentral.log", level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

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


# Connection Pool
dbconfig = {
    'host': config['database']['host'],
    'user': config['database']['user'],
    'password': config['database']['password'],
    'database': config['database']['database']
}
connection_pool = pooling.MySQLConnectionPool(pool_name="mypool", pool_size=10, **dbconfig)

def get_connection():
    return connection_pool.get_connection()



# =============CHECK DEVICE REACHABILITY - PING ======================
def is_host_reachable(ip):
    try:
        if platform.system().lower() == "windows":
            response = subprocess.run(["ping", "-n", "1", ip], stdout=subprocess.PIPE)
        else:
            response = subprocess.run(["ping", "-c", "1", ip], stdout=subprocess.PIPE)
        return response.returncode == 0
    except Exception as e:
        logging.error(f"Ping failed for {ip}: {e}")
        return False


def check_devices_reachability():
    while True:
        try:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT id, ip_address, name, status FROM network_equipment")
            devices = cursor.fetchall()
            cursor.close()
            conn.close()

            for device in devices:
                reachable = is_host_reachable(device['ip_address'])

                if not reachable and device['status'] != 'down':
                    message = f"Device DOWN: {device['name']} ({device['ip_address']})"
                    logging.warning(message)
                    try:
                        conn = get_connection()
                        cursor = conn.cursor()
                        cursor.execute("UPDATE network_equipment SET status='down' WHERE id=%s", (device['id'],))
                        cursor.execute("INSERT INTO alerts (message, severity, timestamp, device_id) VALUES (%s, %s, %s, %s)", (message, 4, datetime.now(), device['id']))
                        conn.commit()
                        cursor.close()
                        conn.close()
                    except Exception as e:
                        logging.error(f"Failed to update status or insert alert: {e}")

                elif reachable and device['status'] != 'active':
                    try:
                        conn = get_connection()
                        cursor = conn.cursor()
                        cursor.execute("UPDATE network_equipment SET status='active' WHERE id=%s", (device['id'],))
                        cursor.execute("DELETE FROM alerts WHERE device_id=%s", (device['id'],))
                        conn.commit()
                        cursor.close()
                        conn.close()
                    except Exception as e:
                        logging.error(f"Failed to update status back to active: {e}")

        except Exception as e:
            logging.error(f"Error during device check: {e}")

        time.sleep(5)  # Wait 5 minutes

ping_thread = threading.Thread(target=check_devices_reachability, daemon=True)
ping_thread.start()
# =============CHECK DEVICE REACHABILITY - PING ======================


##====================================================================
#                       LOGIN
#=====================================================================

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

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
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role FROM users")
    users = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(users), 200

@app.route('/users', methods=['POST'])
def add_user():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user')
    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO users (username, password_hash, role) VALUES (%s, %s, %s)",
        (username, password_hash, role)
    )
    conn.commit()
    cursor.close()
    conn.close()
    logging.info(f"User {username} added with role {role}")
    return jsonify({"message": "User Added"}), 201

@app.route('/users/<int:id>', methods=['PUT'])
def update_user(id):
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')

    conn = get_connection()
    cursor = conn.cursor()

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

    conn.commit()
    cursor.close()
    conn.close()

    logging.warning(f"User {username}'s account details updated")

    return jsonify({"message": "User updated"}), 200


@app.route('/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    
    cursor.execute("SELECT username FROM users WHERE id = %s", (id,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        conn.close()
        return jsonify({"error": "User not found"}), 404

    username = user['username']

    
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))
    conn.commit()
    cursor.close()
    conn.close()

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

    try:
        try:
            conn = get_connection()
        except mysql.connector.Error as conn_err:
            logging.error(f"Error: Failed to get connection from pool: {conn_err}")
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM network_equipment")
        devices = cursor.fetchall()
        cursor.close()
        conn.close()
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

def get_snmp_data_v3(ip_address, oid, username, auth_protocol, auth_password, priv_protocol, priv_password):
    try:
        result = subprocess.run(
            [
                'snmpget', '-v3',
                '-l', 'authPriv',  # auth + encryption
                '-u', username,
                '-a', auth_protocol.lower(),  # md5 or sha 
                '-A', auth_password,
                '-x', priv_protocol.lower(),  # des or aes
                '-X', priv_password,
                ip_address, oid
            ],
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
        print(f"Exception occurred during SNMPv3 get: {e}")
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

def get_device_info_v3(ip_address, username, auth_protocol, auth_password, priv_protocol, priv_password):
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
    full_description = get_snmp_data_v3(ip_address, model_oid, username, auth_protocol, auth_password, priv_protocol, priv_password)
    if not full_description:
        return None  

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
    device_info['hostname'] = get_snmp_data_v3(ip_address, hostname_oid, username, auth_protocol, auth_password, priv_protocol, priv_password) or device_info['hostname']

    # Getting SNMP location
    device_info['location'] = get_snmp_data_v3(ip_address, location_oid, username, auth_protocol, auth_password, priv_protocol, priv_password) or device_info['location']

    return device_info



@app.route('/devices/add', methods=['POST'])
def add_device():
    data = request.json
    ip_address = data.get('ip_address')
    version = data.get('version', '2c')

    # NMPv2c
    community = data.get('community', 'public')

    # SNMPv3
    username_snmp = data.get('username')
    auth_protocol = data.get('authProtocol')
    auth_password = data.get('authPassword')
    priv_protocol = data.get('privProtocol')
    priv_password = data.get('privPassword')

    if not ip_address:
        logging.error("Attempt to add device without IP address")
        return jsonify({"error": "IP address is required"}), 400

    token = request.headers.get('Authorization', '').split(' ')[1]
    try:
        decoded_token = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        username = decoded_token.get('username')
        print(f"Decoded username: {username}")
    except jwt.ExpiredSignatureError:
        logging.error("Error: Token has expired")
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        logging.error("Error: Invalid token")
        return jsonify({"Error": "Invalid token"}), 401

    # getting data via different snmpS
    if version == '2c':
        device_info = get_device_info(ip_address, community)
    elif version == '3':
        device_info = get_device_info_v3(ip_address, username_snmp, auth_protocol, auth_password, priv_protocol, priv_password)
    else:
        return jsonify({"error": "Unsupported SNMP version"}), 400

    if not device_info:
        try:
            conn = get_connection()
        except mysql.connector.Error as conn_err:
            logging.error(f"Failed to get DB connection to log SNMP failure: {conn_err}")
            return jsonify({"error": "Database connection error"}), 500

        cursor = conn.cursor()
        action_description = f"Error: User {username} - Failed to connect to device at {ip_address}. No response received."
        logging.warning(action_description)
        print(action_description)
        timestamp = datetime.now()
        cursor.execute("INSERT INTO recent_activity (message, timestamp) VALUES (%s, %s)", (action_description, timestamp))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"error": f"Failed to connect to device at {ip_address}. No response received."}), 500

    try:
        conn = get_connection()
    except mysql.connector.Error as conn_err:
        logging.error(f"Error: Failed to get DB connection for adding device: {conn_err}")
        return jsonify({"error": "Database connection error"}), 500

    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO network_equipment (ip_address, name, model, manufacturer, status, location) VALUES (%s, %s, %s, %s, %s, %s)",
            (device_info['ip_address'], device_info['hostname'], device_info['model'], device_info['manufacturer'], device_info['status'], device_info['location'])
        )
        conn.commit()

        # adding recent activity
        action_description = f"User {username} added a new device {device_info['hostname']} | IP: {device_info['ip_address']}"
        logging.info(action_description)
        print(action_description)
        timestamp = datetime.now()
        cursor.execute("INSERT INTO recent_activity (message, timestamp) VALUES (%s, %s)", (action_description, timestamp))
        conn.commit()

        cursor.close()
        conn.close()

        return jsonify(device_info), 201

    except mysql.connector.Error as db_err:
        logging.error(f"Error during DB insert for device {ip_address}: {db_err}")
        return jsonify({"error": "Failed to add device to database"}), 500




@app.route('/devices/<int:device_id>', methods=['GET'])
def get_device_details(device_id):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM network_equipment WHERE id = %s", (device_id,))
        device_info = cursor.fetchone()
        cursor.close()
        conn.close()

        if device_info:
            return jsonify(device_info), 200
        else:
            return jsonify({"error": "Device not found"}), 404

    except mysql.connector.Error as e:
        logging.error(f"Error retrieving device {device_id}: {e}")
        return jsonify({"error": "Database error occurred"}), 500

@app.route('/devices/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    username = request.headers.get('Username', 'Unknown')
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT name, ip_address FROM network_equipment WHERE id = %s", (device_id,))
        device_info = cursor.fetchone()

        if not device_info:
            return jsonify({"error": "Device not found"}), 404

        cursor.execute("DELETE FROM alerts WHERE device_id = %s", (device_id,)) # Deleting alerts which is connected with the device

        cursor.execute("DELETE FROM network_equipment WHERE id = %s", (device_id,)) # deleteing device

        action_description = f"User {username} deleted a device {device_info['name'] or 'Unknown'} | IP: {device_info['ip_address']}"
        timestamp = datetime.now()
        cursor.execute(
            "INSERT INTO recent_activity (message, timestamp) VALUES (%s, %s)",
            (action_description, timestamp)
        )

        conn.commit()
        logging.info(action_description)
        print(action_description)

        response = {"message": "Device and related alerts deleted successfully"}
        status_code = 200

    except Exception as e:
        print(f"Error deleting device and alerts: {e}")
        response = {"error": "Failed to delete device and alerts"}
        status_code = 500

    finally:
        cursor.close()
        conn.close()

    return jsonify(response), status_code


#Updating device info
@app.route('/devices/update_all', methods=['POST'])
def update_all_devices():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        
        cursor.execute("SELECT * FROM network_equipment")
        devices = cursor.fetchall()

        for device in devices:
            ip_address = device['ip_address']

            
            community = device.get('community', 'public')
            updated_info = get_device_info(ip_address, community)

            if updated_info: #If device is UP - get info
                cursor.execute("""
                    UPDATE network_equipment
                    SET name = %s,
                        location = %s,
                        status = 'active'
                    WHERE ip_address = %s
                """, (
                    updated_info['hostname'],
                    updated_info['location'],
                    ip_address
                ))
            else:
                # If device is not responding - change status to donw
                cursor.execute("""
                    UPDATE network_equipment
                    SET status = 'inactive'
                    WHERE ip_address = %s
                """, (ip_address,))

        conn.commit()
        cursor.close()
        conn.close()

        logging.info("All devices were updated successfully.")
        return jsonify({"message": "All devices updated successfully."}), 200

    except Exception as e:
        print(f"Error updating devices: {e}")
        return jsonify({"error": "Failed to update devices."}), 500




##====================================================================
#                       Recent Activity
#====================================================================

@app.route('/recent-activity', methods=['GET'])
def get_recent_activity():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT message, timestamp FROM recent_activity ORDER BY timestamp DESC LIMIT 5")
        recent_activity = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(recent_activity), 200

    except mysql.connector.Error as e:
        import traceback
        logging.error("Traceback: " + traceback.format_exc())
        logging.error(f"Database error: {e}")
        return jsonify({"error": f"Database error: {e}"}), 500

    except Exception as e:
        import traceback
        logging.error("Traceback: " + traceback.format_exc())
        logging.error(f"Unexpected error: {e}")
        return jsonify({"error": f"Unexpected error: {e}"}), 500





##====================================================================
#                       Recent Activity
#====================================================================

@app.route('/alerts',methods=['GET'])
def get_alerts():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id, message, severity, timestamp FROM alerts ORDER BY timestamp DESC LIMIT 10")
        alerts = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(alerts), 200
    except Exception as e:
        import traceback
        logging.error("Traceback: " + traceback.format_exc())
        logging.error(f"Failed to fetch alerts: {e}")
        return jsonify({"error": "Failed to fetch alerts"}), 500


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

    data = request.json
    logging.info(f"Raw data received in POST: {data}")
    device_ip = data.get('device_ip')

    if not device_ip:
        return jsonify({"error": "Missing device IP"}), 400

    ansibleUser = config['ansible']['username']
    ansiblePassword = config['ansible']['password']

    
    env = {
        **os.environ,
        "ANSIBLE_CONFIG": "/home/vlc/bakalauro_Kodas/backend/ansible.cfg",
        "ANSIBLE_SSH_TYPE": "paramiko",
        "ANSIBLE_HOST_KEY_CHECKING": "False"
    }

    deviceProfiles = {
        "Cisco": {
            "network_os": "cisco.ios.ios",
            "connection": "network_cli"
        },
        "MikroTik": {
            "network_os": "routeros",
            "connection": "network_cli"
        }
    }

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT manufacturer FROM network_equipment WHERE ip_address = %s", (device_ip,))
        device = cursor.fetchone()
        cursor.close()

        if not device:
            conn.close()
            return jsonify({"error": "Device not found in database"}), 404

        manufacturer = device.get("manufacturer")
        profile = deviceProfiles.get(manufacturer)

        if not profile:
            conn.close()
            return jsonify({"error": f"Unsupported manufacturer: {manufacturer}"}), 400

        network_os = profile["network_os"]
        connection = profile["connection"]

        
        cmd = [
            "/home/vlc/bakalauro_Kodas/backend/venv/bin/ansible-playbook",
            os.path.join(ANSIBLE_PLAYBOOKS_DIR, filename),
            "-i", f"{device_ip},",
            "-u", ansibleUser,
            "--extra-vars",
            f"ansible_password={ansiblePassword} ansible_network_os={network_os} ansible_command_timeout=120 ansible_become_password=cisco "
            f"ansible_connection={connection} target={device_ip}",
            "--ssh-common-args",
            "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -oKexAlgorithms=+diffie-hellman-group14-sha1 -oHostKeyAlgorithms=+ssh-rsa -oCiphers=aes128-cbc,aes192-cbc,aes256-cbc,3des-cbc"
        ]

        logging.info(f"Executing command: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        cursor = conn.cursor()
        cursor.execute("INSERT INTO playbook_usage (playbook_name, executed_at) VALUES (%s, NOW())", (filename,))
        conn.commit()
        cursor.close()
        conn.close()

        logging.info(f"Playbook {filename} executed. Output:\n{result.stdout}")
        return jsonify({
            "message": "Execution completed",
            "output": result.stdout,
            "error": result.stderr
        }), 200

    except Exception as e:
        logging.error(f"Error executing playbook {filename}: {e}")
        return jsonify({"error": "Failed to execute playbook"}), 500


@app.route('/playbooks/top-used', methods=['GET'])
def get_top_used_playbooks():
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT playbook_name, COUNT(*) as usage_count, MAX(executed_at) as last_used
            FROM playbook_usage
            GROUP BY playbook_name
            ORDER BY last_used DESC
            LIMIT 5
        """)
        top_playbooks = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(top_playbooks), 200

    except mysql.connector.Error as e:
        import traceback
        logging.error("Traceback: " + traceback.format_exc())
        logging.error(f"Database error fetching top used playbooks: {e}")
        return jsonify({"error": "Database error"}), 500

    except Exception as e:
        import traceback
        logging.error("Traceback: " + traceback.format_exc())
        logging.error(f"Unexpected error: {e}")
        return jsonify({"error": "Unexpected error occurred"}), 500





##====================================================================
#                       MAIN
#====================================================================

if __name__ == '__main__':
    logging.info("Starting NetCentral backend")
    app.run(host='0.0.0.0', port=5000, debug=True)
