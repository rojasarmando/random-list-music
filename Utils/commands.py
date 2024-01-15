import sys

def menu():
    
    path = ''
    option = ''

    if len(sys.argv) > 1:
        path = sys.argv[1]
    else:
        print("Path?")
        path = input(">")

        if(len(path) < 3):
            print("Path not found")
            exit(-1)

    if len(sys.argv) > 2:
        option = sys.argv[2]
    else:
        print("Option?  (original or mix) ")
        option = input(">")

        if(option != "original" and option != "mix"):
            print("Option not found")
            exit(-1) 
            
            
    return path, option