CREATE TABLE users (
    userId VARCHAR(50) PRIMARY KEY
);

CREATE TABLE lists (
    listId SERIAL PRIMARY KEY,
    list TEXT NOT NULL
);

CREATE TABLE usersToLists (
    userId VARCHAR(50) NOT NULL REFERENCES users(UserId),
    listId INT NOT NULL REFERENCES lists(listId)
);