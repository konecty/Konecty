cookie="Cookie: _authTokenNs=egalite; KonectyNS=egalite; KonectyUser=admin; _authTokenId=540387370cf216c5c6f21bd2;"
gzip="Accept-Encoding: gzip,deflate;"
json="Content-Type: application/json"

# rest="rest/menu/list"
# rest="rest/auth/info"
# rest="rest/data/Lead/lookup/_user?search=&page=1&start=0&limit=25"
# rest="rest/comment/Contact/51efd6dbe4b0073ee3096b4c"

# rest="rest/data/Contact"
# data='{"ids":[{"_id":{"$oid":"51ade192e4b0f48cf3fc112a"},"_updatedAt":{"$date":"2013-07-08T23:37:44.636Z"}}],"data":{"code": 5, "name":{"first":"Perto 10"}, "_updatedAt":{"$date":"2013-07-08T23:37:44.636Z"}}}'

# rest="rest/data/Contact"
# data='{"code": 1000024, "name":{"first":"Perto 10"}, "queue":{"_id":{"$oid":"51a812bae4b094ed9ef28015"}}}'

# data='{"text":"asd2"}'

# POST
# echo "http://konecty.local/$rest"
# curl -H "$cookie" -H "$json" -d "$data" "http://konecty.local/$rest" | python -m json.tool > oldKonecty.txt

# echo ""
# echo ""

# echo "http://localhost:3000/$rest"
# curl -H "$cookie" -H "$json" -d "$data" "https://90de257f433180af.a.passageway.io/$rest" | python -m json.tool > newKonecty.txt

#PUT
# echo "http://konecty.local/$rest"
# curl -H "$cookie" -H "$json" -X PUT -d "$data" "http://konecty.local/$rest" | python -m json.tool > oldKonecty.txt

# echo ""
# echo ""

# echo "http://localhost:3000/$rest"
# curl -H "$cookie" -H "$json" -X PUT -d "$data" "http://localhost:3000/$rest" | python -m json.tool > newKonecty.txt

#GET
# rest="rest/data/Contact/51ade717e4b0f48cf3fc1141"
# echo "http://konecty.local/$rest"
# curl -H "$cookie" "http://konecty.local/$rest" | python -m json.tool > oldKonecty.txt
# echo "\n\nhttp://localhost:3000/$rest"
# curl -H "$cookie" "http://localhost:3000/$rest" | python -m json.tool > newKonecty.txt

# DELETE ONE record
# rest="rest/data/Contact/51ade717e4b0f48cf3fc1141"
# echo "http://konecty.local/$rest"
# curl -X DELETE -H "$cookie" "http://konecty.local/$rest"  > oldKonecty.txt
# echo "\n\nhttp://localhost:3000/$rest"
# curl -X DELETE -H "$cookie" "http://localhost:3000/$rest"  > newKonecty.txt

# DELETE Many records
rest="rest/data/Contact"
data='{"ids":[{"_id":{"$oid":"51ade46be4b0f48cf3fc1139"},"_updatedAt":{"$date":"2013-07-11T01:00:54.779Z"}}]}'
# echo "http://konecty.local/$rest"
# curl -X DELETE -d "$data" -H "$cookie" "http://konecty.local/$rest" | python -m json.tool > oldKonecty.txt
echo "\n\nhttp://localhost:3000/$rest"
curl -X DELETE -d "$data" -H "$cookie" -H "$json" "http://localhost:3000/$rest" | python -m json.tool > newKonecty.txt


# json diff oldKonecty.txt newKonecty.txt
# colordiff oldKonecty.txt newKonecty.txt
vim -d oldKonecty.txt newKonecty.txt
# opendiff oldKonecty.txt newKonecty.txt

# rm oldKonecty.txt
# rm newKonecty.txt