var config = module.exports;

config["My tests"] = {
    rootPath: "../",
    environment: "browser", // or "node"
    sources: [
        "scripts/jquery-1.9.1.min.js",
        "scripts/publican-pressgang-utils.js"
    ],
    tests: [
        "spec/*-spec.js"
    ]
}

// Add more configuration groups as needed