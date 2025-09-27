CREATE DATABASE IF NOT EXISTS miles_school;
USE miles_school;
CREATE TABLE users(
	email varchar(50) PRIMARY KEY,
    user_password TEXT NOT NULL,
    username varchar(50) not null,
    cred_score int default 0,
    reviews_given int default 0,
    rep_points int default 0

    );
CREATE INDEX email_index ON users(email); 