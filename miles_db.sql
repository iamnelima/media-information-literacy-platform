CREATE DATABASE IF NOT EXISTS miles_school;
USE miles_school;
CREATE TABLE users(
	email varchar(50) PRIMARY KEY,
    user_password TEXT NOT NULL,
    username varchar(50) not null,
    rep_points int default 0,
    reviews_given int default 0,
    no_of_posts int default 0

    );
CREATE INDEX email_index ON users(email); 

CREATE TABLE posts(
	post_id VARCHAR(30) PRIMARY KEY,
    author VARCHAR(50) NOT NULL,
    image_location TEXT NOT NULL,
    text_content TEXT NOT NULL,
    credibility_score INT NOT NULL,
    date_of_check DATE NOT NULL,
    verdict_label VARCHAR(50) NOT NULL,
    verdict_color VARCHAR(20) NOT NULL,
    ai_analysis TEXT NOT NULL
    );

CREATE INDEX posts_index ON posts(post_id); 
CREATE INDEX author_index ON posts(author); 

CREATE TABLE comments(
comment_id VARCHAR(50) PRIMARY KEY,
post_id VARCHAR(30) NOT NULL,
commenter VARCHAR(50) NOT NULL,
review TEXT NOT NULL
);