const mongoose = require("mongoose");
const SizeGuideSchema = require("./schema");

const SizeGuide = mongoose.model("SizeGuide", SizeGuideSchema);

module.exports = SizeGuide;

