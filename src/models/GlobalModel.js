import mongoose from "mongoose";
import moment from "moment";

const GlobalSchema = mongoose.Schema(
  {
    id: Number,
    platformName: { type: String, default: null },
    platformDescription: { type: String, default: null },
    email: { type: String, required: true },
    google_analytics_id: { type: String, required: true },
    google_tag_manager: { type: String, required: true },
    icon_image: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    marketplace_name: { type: String, default: null },
    meta_description: { type: String, default: null },
    meta_keywords: { type: String, default: null },
    meta_title: { type: String, default: null },
    og_tag: { type: String, default: null },
    phone: { type: String, required: true },
    schema_markup: { type: String, default: null },
    search_console: { type: String, required: true },
    instagram_logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    instagram_link: { type: String, default: null },
    facebook_logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    facebook_link: { type: String, default: null },
    x_logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    x_link: { type: String, default: null },
    linkedin_logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    footer_logo: {
      type: String,
      get: (val) => {
        if (!val) return null;
        return `${process.env.IMAGE_URL}${val}`;
      },
    },
    linkedin_link: { type: String, default: null },

    address: {
      type: String,
      default: null,
    },

    home_youtube_link: { type: String, default: null },

    quote_limit: { type: Number, default: 5 },
    quote_expired: { type: Number, default: 7 },
  },
  {
    timestamps: {},
    retainNullValues: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

GlobalSchema.path("createdAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY") : null;
});
GlobalSchema.path("updatedAt").get(function (value) {
  return value ? moment(value).format("DD-MM-YYYY") : null;
});

const Global = mongoose.model("Global", GlobalSchema);

export default Global;
