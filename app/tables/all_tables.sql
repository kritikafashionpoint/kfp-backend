CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- website tables
CREATE TABLE web_user (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    name VARCHAR(150) NOT NULL,

    mobile VARCHAR(15) NOT NULL UNIQUE,

    password TEXT NOT NULL,

    is_verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart (
    cart_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL,

    product_id UUID NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cart_user
        FOREIGN KEY (user_id)
        REFERENCES web_user(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_cart_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE
);










-- admin tables
CREATE TABLE IF NOT EXISTS admin_user
(
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    admin_email character varying(150) NOT NULL,
    admin_password character varying(255) NOT NULL,
    otp bigint,
    otp_expire timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT admin_user_pkey PRIMARY KEY (id),
    CONSTRAINT admin_user_admin_email_key UNIQUE (admin_email),
    CONSTRAINT admin_user_otp_check CHECK (otp >= 100000 AND otp <= 999999)
);

CREATE TABLE IF NOT EXISTS categories
(
    category_id uuid NOT NULL DEFAULT uuid_generate_v4(),
    category_name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    category_slug character varying(255) COLLATE pg_catalog."default" NOT NULL,
    category_image text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT categories_pkey PRIMARY KEY (category_id),
    CONSTRAINT categories_category_slug_key UNIQUE (category_slug)
)

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    p_title VARCHAR(255) NOT NULL,

    p_slug VARCHAR(255) NOT NULL,

    p_short_description TEXT,

    p_full_description TEXT,

	p_discount INT DEFAULT NULL,

	p_advance_payment INT DEFAULT NULL,


    p_type VARCHAR(20)
    CHECK (p_type IN ('single', 'combo')),

    is_top_selling BOOLEAN DEFAULT FALSE,

    p_quantity INT DEFAULT 0,

    p_sale_price NUMERIC(10,2) NOT NULL,

    p_customer_price NUMERIC(10,2) NOT NULL,

    p_material VARCHAR(255),

    p_finishing VARCHAR(255),

    p_occasion VARCHAR(255),

    p_include_items VARCHAR(255),

    p_meta_title VARCHAR(255),

    p_meta_description  VARCHAR(255),

    category_id UUID,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_category
    FOREIGN KEY (category_id)
    REFERENCES categories(category_id)
    ON DELETE SET NULL
);

CREATE TABLE product_images (

    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    product_id UUID NOT NULL,

    -- Single Main Image
    index_image TEXT NOT NULL,

    -- Multiple Gallery Images
    gallery_images TEXT[],

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON DELETE CASCADE
);

CREATE TABLE contact_messages (
    id SERIAL PRIMARY KEY,

    name VARCHAR(150) NOT NULL,

    phone VARCHAR(20) NOT NULL,

    message TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);





-- payment tables


CREATE TABLE wishlist (
    wishlist_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL,

    product_id UUID NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_wishlist_user
        FOREIGN KEY (user_id)
        REFERENCES web_user(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_wishlist_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,

    CONSTRAINT unique_user_product
        UNIQUE (user_id, product_id)
);






CREATE TABLE IF NOT EXISTS orders(
    id bigint NOT NULL DEFAULT nextval('orders_id_seq'::regclass),
    uuid character varying(100) COLLATE pg_catalog."default" NOT NULL,
    user_id uuid NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    payment_type character varying(20) COLLATE pg_catalog."default",
    payment_status character varying(20) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    order_status character varying(20) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    razorpay_order_id character varying(255) COLLATE pg_catalog."default",
    razorpay_payment_id character varying(255) COLLATE pg_catalog."default",
    razorpay_signature text COLLATE pg_catalog."default",
    CONSTRAINT orders_pkey PRIMARY KEY (id),
    CONSTRAINT orders_uuid_key UNIQUE (uuid),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
        REFERENCES public.web_user (user_id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)


CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL,

    product_id UUID NOT NULL,

    quantity INTEGER DEFAULT 1,

    price NUMERIC(10,2) NOT NULL,

    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
);


CREATE TABLE replacement_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    order_id BIGINT NOT NULL,

    order_item_id BIGINT NOT NULL,

    user_id UUID NOT NULL,

    reason TEXT NOT NULL,

    description TEXT NOT NULL,

    image TEXT NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending',

    admin_remark TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_replace_order
        FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_replace_item
        FOREIGN KEY (order_item_id)
        REFERENCES order_items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_replace_user
        FOREIGN KEY (user_id)
        REFERENCES web_user(user_id)
        ON DELETE CASCADE
);




CREATE TABLE user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    city VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_address
        FOREIGN KEY (user_id)
        REFERENCES web_user(user_id)
        ON DELETE CASCADE
);