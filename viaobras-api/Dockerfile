# syntax=docker/dockerfile:1
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
# ext-gd é exigida pelo phpoffice/phpword; ela é instalada na imagem final (estágio abaixo),
# então aqui a checagem de plataforma do Composer a ignora.
RUN composer install --no-dev --no-interaction --no-progress --no-scripts --prefer-dist --optimize-autoloader --ignore-platform-req=ext-gd

FROM php:8.4-fpm-alpine
RUN apk add --no-cache icu-libs libzip libpng libjpeg-turbo freetype procps \
    && apk add --no-cache --virtual .build icu-dev libzip-dev libpng-dev libjpeg-turbo-dev freetype-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql intl zip bcmath opcache gd \
    && apk del .build

WORKDIR /var/www/html
COPY --from=vendor /app/vendor ./vendor
COPY . .
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

USER www-data
EXPOSE 9000
CMD ["php-fpm"]
