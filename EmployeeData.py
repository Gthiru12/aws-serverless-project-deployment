import json
import os
import boto3
from boto3.dynamodb.conditions import Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb')
TABLE_NAME = os.getenv("TABLE_NAME", "employeeData")
table = dynamodb.Table(TABLE_NAME)

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Origin,Accept",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}

def response(status, body):
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body)
    }

def lambda_handler(event, context):
    method = event.get("httpMethod", "")
    path_params = event.get("pathParameters") or {}
    query = event.get("queryStringParameters") or {}
    raw_body = event.get("body")
    body = json.loads(raw_body) if raw_body else {}

    # Preflight
    if method == "OPTIONS":
        return response(200, {"ok": True})

    resource = event.get("resource", "")  # "/employees" or "/employees/{employeeid}"

    try:
        # -------------------------
        # /employees
        # -------------------------
        if resource == "/employees":
            if method == "GET":
                search = (query.get("search") or "").strip()

                scan_kwargs = {}
                if search:
                    # Alias the reserved attribute "name" to "#n"
                    filter_expr = (
                        Attr("employeeid").contains(search) |
                        Attr("#n").contains(search) |
                        Attr("department").contains(search)
                    )
                    scan_kwargs["FilterExpression"] = filter_expr
                    scan_kwargs["ExpressionAttributeNames"] = {"#n": "name"}

                items = []
                last_evaluated_key = None
                while True:
                    if last_evaluated_key:
                        scan_kwargs["ExclusiveStartKey"] = last_evaluated_key
                    resp = table.scan(**scan_kwargs)
                    items.extend(resp.get("Items", []))
                    last_evaluated_key = resp.get("LastEvaluatedKey")
                    if not last_evaluated_key:
                        break

                items.sort(key=lambda x: x.get("employeeid", ""))
                return response(200, items)

            elif method == "POST":
                employeeid = (body.get("employeeid") or "").strip()
                name = (body.get("name") or "").strip()
                department = (body.get("department") or "").strip()
                salary = (body.get("salary") or "").strip()

                if not (employeeid and name and department and salary):
                    return response(400, {"error": "Missing required fields."})

                try:
                    table.put_item(
                        Item={
                            "employeeid": employeeid,
                            "name": name,
                            "department": department,
                            "salary": salary  # keep as string
                        },
                        ConditionExpression="attribute_not_exists(employeeid)"  # prevent overwrite
                    )
                except ClientError as e:
                    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                        return response(409, {"error": "Employee already exists.", "employeeid": employeeid})
                    raise

                return response(201, {"message": "Employee created.", "employeeid": employeeid})

        # -------------------------
        # /employees/{employeeid}
        # -------------------------
        elif resource == "/employees/{employeeid}":
            emp_id = path_params.get("employeeid")
            if not emp_id:
                return response(400, {"error": "employeeid path param required."})

            if method == "GET":
                resp = table.get_item(Key={"employeeid": emp_id})
                item = resp.get("Item")
                if not item:
                    return response(404, {"error": "Not found"})
                return response(200, item)

            elif method == "PUT":
                # Build update expression; alias "name" to avoid reserved word
                update_parts = []
                expr_vals = {}
                expr_names = {}

                if "name" in body:
                    update_parts.append("#n = :n")
                    expr_vals[":n"] = str(body["name"])
                    expr_names["#n"] = "name"

                if "department" in body:
                    update_parts.append("department = :d")
                    expr_vals[":d"] = str(body["department"])

                if "salary" in body:
                    update_parts.append("salary = :s")
                    expr_vals[":s"] = str(body["salary"])

                if not update_parts:
                    return response(400, {"error": "No updatable fields in body."})

                kwargs = {
                    "Key": {"employeeid": emp_id},
                    "UpdateExpression": "SET " + ", ".join(update_parts),
                    "ExpressionAttributeValues": expr_vals,
                    "ConditionExpression": "attribute_exists(employeeid)",
                    "ReturnValues": "UPDATED_NEW",
                }
                if expr_names:
                    kwargs["ExpressionAttributeNames"] = expr_names

                try:
                    table.update_item(**kwargs)
                except ClientError as e:
                    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                        return response(404, {"error": "Employee not found."})
                    raise

                return response(200, {"message": "Employee updated.", "employeeid": emp_id})

            elif method == "DELETE":
                try:
                    table.delete_item(
                        Key={"employeeid": emp_id},
                        ConditionExpression="attribute_exists(employeeid)"
                    )
                except ClientError as e:
                    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                        return response(404, {"error": "Employee not found."})
                    raise

                return response(200, {"message": "Employee deleted.", "employeeid": emp_id})

        # Unknown route/method
        return response(404, {"error": "Route not found."})

    except Exception as e:
        # For debugging; check CloudWatch Logs for stack traces
        return response(500, {"error": str(e)})
