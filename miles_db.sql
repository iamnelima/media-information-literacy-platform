CREATE DATABASE IF NOT EXISTS miles_db;
USE miles_db;
CREATE TABLE users(
	email varchar(50) PRIMARY KEY,
    user_password TEXT NOT NULL
    );
CREATE INDEX email_index ON users(email); 