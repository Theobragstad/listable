CREATE TABLE users (
    userId VARCHAR(50) PRIMARY KEY
);

CREATE TABLE lists (
    listId SERIAL PRIMARY KEY,
    title VARCHAR(25) NOT NULL,
    list TEXT NOT NULL,
    color VARCHAR(6) NOT NULL,
    trash BOOLEAN NOT NULL
);

CREATE TABLE listsToUsers (
    listId INT NOT NULL REFERENCES lists(listId),
    userId VARCHAR(50) NOT NULL REFERENCES users(UserId)
);
