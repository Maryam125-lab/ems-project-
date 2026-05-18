øk first on sending this payload: 
{
    "email": "zaidbinasif468@gmail.com",
    "password":"Zaidkhan123!"
}

in this route http://localhost:3001/api/auth/login  its returns this payload {
    "success": true,
    "data": {
        "user": {
            "id": "bc0fd23e-1bfe-4e18-9cf7-da8e148f86e5",
            "email": "zaidbinasif468@gmail.com",
            "employee_id": "EMP001",
            "must_change_password": false
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiYmMwZmQyM2UtMWJmZS00ZTE4LTljZjctZGE4ZTE0OGY4NmU1IiwiZW1wbG95ZWVfaWQiOiJFTVAwMDEiLCJyb2xlX2lkIjoiNTE0YWIxNzUtYjMwNS00M2NiLTk2YWQtYWU3MTIyMGI4NDE5IiwibXVzdF9jaGFuZ2VfcGFzc3dvcmQiOnRydWUsImlhdCI6MTc3ODA1MzYyMCwiZXhwIjoxNzc4MDgyNDIwfQ.LEGhX3kO-Mx-Rq4Oh9y-8Rdlk7K8vJUTyLo8QIJ6SG0"
    }
}


then after that we neeeeed to change the password first to if we do anthing or hit any route it show this payload 
{
    "success": false,
    "error": {
        "code": "MUST_CHANGE_PASSWORD",
        "message": "Password must be changed before continuing."
    }
}

so to change the password we will go to the http://localhost:3001/api/auth/change-password and the payload sent to this will be :
{
  "current_password": "password123",
  "new_password": "passWord123!"
} 
and the ans will be 
{
    "success": true,
    "data": {
        "message": "Password changed."
    }
}
and we have some validations in it if password is worng then is payload answer

401
Unauthorized

{
    "success": false,
    "error": {
        "code": "INVALID_CREDENTIALS",
        "message": "Current password is incorrect."
    }
}

and if the validations like password requriments are not follow then this 
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed.",
        "details": [
            {
                "origin": "string",
                "code": "invalid_format",
                "format": "regex",
                "pattern": "/^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d]).{8,}$/",
                "path": [
                    "new_password"
                ],
                "message": "Password must contain upper, lower, digit, and symbol."
            }
        ]
    }
}
422
Unprocessable Entity

and if both passwords new and current one are same then this one {
    "success": false,
    "error": {
        "code": "SAME_PASSWORD",
        "message": "New password must be different."
    }
}

remember if the "must_change_password": is  "false" then user can't acces other routes except for the a http://localhost:3001/api/auth/change-password  ok so in frontend we will pop up the model and let user chanege password then we let him acces his dashboard and other routes per RBAC 
 

 and on http://localhost:3001/api/auth/session its showing this payload 
{
    "success": true,
    "data": {
        "user_id": "0e8928f0-b55f-4aaf-82ee-95b2ce974ded",
        "employee_id": "EMP002",
        "role_id": "8c6d457b-bd26-4ab4-bd56-96c67bd08ca2",
        "must_change_password": false
    }
}

