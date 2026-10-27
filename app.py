
import os
import logging
from flask import Flask, jsonify, render_template, request
import mysql.connector
from mysql.connector import Error

app = Flask(__name__)
app.logger.setLevel(logging.INFO)


def get_db_connection():
    """Connect to the MySQL database using environment variables."""
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "todo_manager"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "connection_timeout": 10,
        "ssl_disabled": False,
    }

    # Optional CA certificate for verified TLS connections.
    ssl_ca = os.getenv("DB_SSL_CA")
    if ssl_ca:
        config["ssl_ca"] = ssl_ca
        config["ssl_verify_cert"] = True

    return mysql.connector.connect(**config)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/tasks")
def get_tasks():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, title, priority, status, created_at "
            "FROM tasks ORDER BY id DESC"
        )
        tasks = cursor.fetchall()

        for task in tasks:
            if task.get("created_at"):
                task["created_at"] = task["created_at"].strftime(
                    "%d %b %Y, %I:%M %p"
                )

        return jsonify(tasks)

    except Error:
        app.logger.exception("Could not load tasks from MySQL")
        return jsonify({
            "error": "Could not load tasks. Check your database settings."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.post("/api/tasks")
def create_task():
    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    priority = payload.get("priority", "Medium")

    if not title:
        return jsonify({"error": "Please enter a task name."}), 400

    if priority not in ("High", "Medium", "Low"):
        return jsonify({
            "error": "Choose High, Medium, or Low priority."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO tasks (title, priority) VALUES (%s, %s)",
            (title, priority),
        )
        connection.commit()

        return jsonify({
            "id": cursor.lastrowid,
            "message": "Task saved."
        }), 201

    except Error:
        app.logger.exception("Could not save task to MySQL")
        return jsonify({
            "error": "Could not save the task. Check your database settings."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.patch("/api/tasks/<int:task_id>")
def update_task(task_id):
    payload = request.get_json(silent=True) or {}
    status = payload.get("status")

    if status not in ("Pending", "Completed"):
        return jsonify({"error": "Invalid task status."}), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "UPDATE tasks SET status = %s WHERE id = %s",
            (status, task_id),
        )
        connection.commit()
        changed = cursor.rowcount

        if changed == 0:
            return jsonify({
                "error": "Task not found or unchanged."
            }), 404

        return jsonify({"message": "Task updated."})

    except Error:
        app.logger.exception("Could not update task in MySQL")
        return jsonify({
            "error": "Could not update the task. Check your database settings."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM tasks WHERE id = %s",
            (task_id,),
        )
        connection.commit()
        deleted = cursor.rowcount

        if deleted == 0:
            return jsonify({"error": "Task not found."}), 404

        return jsonify({"message": "Task deleted."})

    except Error:
        app.logger.exception("Could not delete task from MySQL")
        return jsonify({
            "error": "Could not delete the task. Check your database settings."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    app.run(debug=True)
