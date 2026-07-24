import mysql.connector
mydb = mysql.connector.connect(
host="localhost",
user="root",
password="n3u3da!",
database="pubs"
)
print(mydb)