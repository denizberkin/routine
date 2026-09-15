-- Run after creating both users in Authentication → Users. Looks ids up by email so nothing is copied by hand.
-- Whoever is inserted first gets the first color (marigold); the second gets lilac.

insert into profiles (id, display_name, avatar_emoji)
select id, 'Deniz', '🎯' from auth.users where email = 'berkindeniz2000@gmail.com'
on conflict (id) do update set display_name = excluded.display_name, avatar_emoji = excluded.avatar_emoji;

insert into profiles (id, display_name, avatar_emoji)
select id, 'Test', '🐢' from auth.users where email = 'friend@example.com'
on conflict (id) do update set display_name = excluded.display_name, avatar_emoji = excluded.avatar_emoji;

insert into profiles (id, display_name, avatar_emoji)
select id, 'Melih', '🐢' from auth.users where email = 'melih.darcan.304@gmail.com'
on conflict (id) do update set display_name = excluded.display_name, avatar_emoji = excluded.avatar_emoji;