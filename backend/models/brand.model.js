const mongoose = require("mongoose");
const slugify = require("slugify");

const BrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên thương hiệu là bắt buộc"],
      trim: true,
      maxlength: [100, "Tên thương hiệu không được vượt quá 100 ký tự"],
    },
    description: {
      type: String,
      maxlength: [1000, "Mô tả thương hiệu không được vượt quá 1000 ký tự"],
    },
    logo: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

BrandSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name, { lower: true, remove: /[*+~.()'"!:@]/g });
  }
  next();
});

const Brand = mongoose.model("Brand", BrandSchema);

module.exports = Brand;
