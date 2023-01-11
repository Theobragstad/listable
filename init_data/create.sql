CREATE TABLE users (
    userId TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    fullname TEXT NOT NULL,
    profilePhotoUrl TEXT NOT NULL,
    listViewType TEXT NOT NULL,
    listPassword TEXT
);

CREATE TABLE lists (
    listId SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    list TEXT NOT NULL,
    color VARCHAR(6) NOT NULL,
    trash BOOLEAN NOT NULL,
    editDateTime VARCHAR(19) NOT NULL,
    createDateTime VARCHAR(19) NOT NULL,
    lastModifiedByEmail TEXT NOT NULL
);

CREATE TABLE listsToUsers (
    listId INT NOT NULL REFERENCES lists(listId),
    userId TEXT NOT NULL REFERENCES users(userId),
    owner BOOLEAN NOT NULL,
    archive BOOLEAN NOT NULL,
    pinned BOOLEAN NOT NULL,
    editable BOOLEAN NOT NULL,
    locked BOOLEAN NOT NULL
);

CREATE TABLE labels (
    labelId SERIAL PRIMARY KEY,
    label VARCHAR(50) NOT NULL
);

CREATE TABLE labelsToUsers (
    labelId INT NOT NULL REFERENCES labels(labelId),
    userId TEXT NOT NULL REFERENCES users(userId)
);

CREATE TABLE labelsToLists (
    labelId INT NOT NULL REFERENCES labels(labelId),
    listId INT NOT NULL REFERENCES lists(listId)
);