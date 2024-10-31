from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from flask_bcrypt import Bcrypt
import json
import jwt
import datetime
from pysnmp.hlapi import *

app = Flask(__name__)
CORS(app)
bcrypt = Bcrypt(app)
app.config['SECRET_KEY'] = 'supersecretkey'
# Настройки подключения к базе данных
db = mysql.connector.connect(
    host="localhost",
    user="vlc",
    password="123",
    database="platform"
)

##====================================================================
#                       LOGIN
#====================================================================

@app.route('/login',methods=['POST'])
def login():
    data = request.json
    print(f"Received login request: {data}") #logging
    username = data.get('username')
    password = data.get('password')

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM users WHERE username=%s", (username,))
    user = cursor.fetchone()
    cursor.close()
    if user:
        print(f"User found: {user['username']}")
    if user and bcrypt.check_password_hash(user['password_hash'], password):
        print("Password is correct, generating token.")
        # Генерация JWT токена
        token = jwt.encode(
            {'user_id': user['id'],
             'role': user['role'],
             'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
             },
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        return jsonify({'token': token}), 200
    else:
        print("Invalid credentials.")
        return jsonify({"error": "Неверные учетные данные"}), 401
#====================================================================
#                       USERS
#====================================================================
# All users list
@app.route('/users', methods=['GET'])
def get_users():
    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT id, username, role FROM users")
    users = cursor.fetchall()
    cursor.close()
    return jsonify(users), 200

# New user
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
    return jsonify({"message": "Пользователь добавлен"}), 201

# Обновление пользователя по ID
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
    return jsonify({"message": "Пользователь обновлен"}), 200

# Удаление пользователя по ID
@app.route('/users/<int:id>', methods=['DELETE'])
def delete_user(id):
    cursor = db.cursor()
    cursor.execute("DELETE FROM users WHERE id = %s", (id,))
    db.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Пользователь не найден"}), 404
    cursor.close()
    return jsonify({"message": "Пользователь удалён"}), 200


#====================================================================
#                       USERS
#====================================================================

# Route for getting network equipment
@app.route('/equipment', methods=['GET'])
def get_equipment():
    token = request.headers.get('Authorization', '').split(' ')[1]
    try:
        jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "Token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "Invalid token"}), 401

    cursor = db.cursor(dictionary=True)
    cursor.execute("SELECT * FROM network_equipment")
    equipment = cursor.fetchall()
    cursor.close()
    return jsonify(equipment), 200






def get_device_info(ip_address, community='public', version='2c'):
    device_info = {
        'ip_address': ip_address,
        'hostname': 'Unknown',
        'model': 'Unknown',
        'manufacturer': 'Unknown',
        'status': 'active'
    }

    try:
        # Пример SNMP-запроса для получения системного описания (System Description)
        for (errorIndication, errorStatus, errorIndex, varBinds) in nextCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=0 if version == '1' else 1),
            UdpTransportTarget((ip_address, 161)),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.2.1.1.1.0')),  # OID для системного описания
            lexicographicMode=False
        ):
            if errorIndication:
                print(f"SNMP Error: {errorIndication}")
                return None
            elif errorStatus:
                print(f"SNMP Error: {errorStatus.prettyPrint()}")
                return None
            else:
                for varBind in varBinds:
                    device_info['model'] = str(varBind[1])  # Получаем System Description

        # Дополнительно можно добавить другие SNMP-запросы для получения имени хоста, производителя и т.д.
        # Пример для получения имени хоста:
        for (errorIndication, errorStatus, errorIndex, varBinds) in nextCmd(
            SnmpEngine(),
            CommunityData(community, mpModel=0 if version == '1' else 1),
            UdpTransportTarget((ip_address, 161)),
            ContextData(),
            ObjectType(ObjectIdentity('1.3.6.1.2.1.1.5.0')),  # OID для системного имени
            lexicographicMode=False
        ):
            if errorIndication:
                print(f"SNMP Error: {errorIndication}")
                return None
            elif errorStatus:
                print(f"SNMP Error: {errorStatus.prettyPrint()}")
                return None
            else:
                for varBind in varBinds:
                    device_info['hostname'] = str(varBind[1])  # Получаем hostname

    except Exception as e:
        print(f"Exception during SNMP request: {e}")
        return None

    return device_info

# Маршрут для добавления устройства
@app.route('/devices/add', methods=['POST'])
def add_device():
    data = request.json
    ip_address = data.get('ip_address')
    community = data.get('community', 'public')
    version = data.get('version', '2c')

    if not ip_address:
        return jsonify({"error": "IP address is required"}), 400

    # Сбор данных об устройстве через SNMP
    device_info = get_device_info(ip_address, community, version)
    if not device_info:
        return jsonify({"error": "Failed to retrieve device information"}), 500

    # Сохранение данных в базе данных
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO network_equipment (ip_address, name, model, manufacturer, status) VALUES (%s, %s, %s, %s, %s)",
        (device_info['ip_address'], device_info['hostname'], device_info['model'], device_info['manufacturer'], device_info['status'])
    )
    db.commit()
    cursor.close()

    return jsonify(device_info), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
